package com.example.inventorysystem.client;

import com.example.inventorysystem.service.CredentialService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class VsphereApiClient {

    private final CredentialService credentialService;
    private final ObjectMapper objectMapper;

    public record VmData(
            String hostname, String fqdn, String vmName, String vmId,
            String cluster, String datacenter, String datastore,
            Integer cpuCount, Integer cpuCores,
            Integer memoryMb, Integer memoryGb, Integer diskGb,
            String powerState, String guestOs, String toolsStatus,
            String ipv4Address, String ipv6Address
    ) {}

    public List<VmData> fetchAllVms(String credentialId) throws Exception {
        Long id = Long.parseLong(credentialId);
        String configJson = credentialService.getDecryptedConfig(id);
        JsonNode config = objectMapper.readTree(configJson);

        String host = config.get("host").asText();
        String username = config.get("username").asText();
        String password = config.get("password").asText();

        RestClient client = RestClient.builder()
                .baseUrl("https://" + host)
                .build();

        // Authenticate — obtain session token
        String sessionToken = client.post()
                .uri("/rest/com/vmware/cis/session")
                .header("Authorization", basicAuth(username, password))
                .retrieve()
                .body(String.class);

        if (sessionToken == null) {
            throw new RuntimeException("Failed to obtain vSphere session token from " + host);
        }
        // Strip surrounding quotes if JSON string
        sessionToken = sessionToken.replaceAll("^\"|\"$", "");

        // Pre-fetch cluster and datacenter mappings (vmId → name)
        Map<String, String> vmToCluster = buildVmToClusterMap(client, sessionToken);
        Map<String, String> vmToDatacenter = buildVmToDatacenterMap(client, sessionToken);

        // Fetch VM list
        String vmsJson = client.get()
                .uri("/rest/vcenter/vm")
                .header("vmware-api-session-id", sessionToken)
                .retrieve()
                .body(String.class);

        List<VmData> result = new ArrayList<>();
        JsonNode vms = objectMapper.readTree(vmsJson).path("value");
        for (JsonNode vm : vms) {
            result.add(mapVm(vm, client, sessionToken, vmToCluster, vmToDatacenter));
        }

        log.info("vSphere sync: fetched {} VMs from {}", result.size(), host);
        return result;
    }

    /** Builds a map of vmId → clusterName by querying each cluster's VM list. */
    private Map<String, String> buildVmToClusterMap(RestClient client, String sessionToken) {
        Map<String, String> vmToCluster = new HashMap<>();
        try {
            String clustersJson = client.get()
                    .uri("/rest/vcenter/cluster")
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            JsonNode clusters = objectMapper.readTree(clustersJson).path("value");
            for (JsonNode cluster : clusters) {
                String clusterId = cluster.path("cluster").asText();
                String clusterName = cluster.path("name").asText();
                try {
                    String vmsJson = client.get()
                            .uri("/rest/vcenter/vm?filter.clusters=" + clusterId)
                            .header("vmware-api-session-id", sessionToken)
                            .retrieve()
                            .body(String.class);
                    for (JsonNode vm : objectMapper.readTree(vmsJson).path("value")) {
                        vmToCluster.put(vm.path("vm").asText(), clusterName);
                    }
                } catch (Exception e) {
                    log.warn("Failed to get VMs for cluster {}: {}", clusterName, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch cluster mapping: {}", e.getMessage());
        }
        return vmToCluster;
    }

    /** Builds a map of vmId → datacenterName by querying each datacenter's VM list. */
    private Map<String, String> buildVmToDatacenterMap(RestClient client, String sessionToken) {
        Map<String, String> vmToDatacenter = new HashMap<>();
        try {
            String datacentersJson = client.get()
                    .uri("/rest/vcenter/datacenter")
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            JsonNode datacenters = objectMapper.readTree(datacentersJson).path("value");
            for (JsonNode dc : datacenters) {
                String dcId = dc.path("datacenter").asText();
                String dcName = dc.path("name").asText();
                try {
                    String vmsJson = client.get()
                            .uri("/rest/vcenter/vm?filter.datacenters=" + dcId)
                            .header("vmware-api-session-id", sessionToken)
                            .retrieve()
                            .body(String.class);
                    for (JsonNode vm : objectMapper.readTree(vmsJson).path("value")) {
                        vmToDatacenter.put(vm.path("vm").asText(), dcName);
                    }
                } catch (Exception e) {
                    log.warn("Failed to get VMs for datacenter {}: {}", dcName, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch datacenter mapping: {}", e.getMessage());
        }
        return vmToDatacenter;
    }

    private VmData mapVm(JsonNode vm, RestClient client, String sessionToken,
                         Map<String, String> vmToCluster, Map<String, String> vmToDatacenter) {
        String vmId = vm.path("vm").asText();
        String vmName = vm.path("name").asText();
        String powerState = vm.path("power_state").asText(null);

        // Fetch VM details for full hardware info
        try {
            String detailJson = client.get()
                    .uri("/rest/vcenter/vm/" + vmId)
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);

            JsonNode detail = objectMapper.readTree(detailJson).path("value");
            JsonNode hardware = detail.path("hardware");
            JsonNode guest = detail.path("guest");

            // FQDN: use guest hostname only if it is fully qualified (contains a dot)
            String guestHostname = guest.path("host_name").asText(null);
            String fqdn = (guestHostname != null && guestHostname.contains(".")) ? guestHostname : null;
            String hostname = guestHostname != null
                    ? guestHostname.split("\\.")[0].toLowerCase()
                    : vmName.toLowerCase();

            String guestOs = detail.path("guest_OS").asText(null);
            Integer cpuCount = hardware.path("num_cpus").isInt() ? hardware.path("num_cpus").asInt() : null;
            Integer cpuCores = hardware.path("num_cores_per_socket").isInt()
                    ? hardware.path("num_cores_per_socket").asInt() : null;
            Integer memoryMb = hardware.path("memory_size_MiB").isInt()
                    ? hardware.path("memory_size_MiB").asInt() : null;
            Integer memoryGb = memoryMb != null ? memoryMb / 1024 : null;

            // Sum all disk capacities (bytes → GB); API returns disks as an object keyed by disk key
            Integer diskGb = extractDiskGb(detail.path("disks"));
            // Extract datastore name from first disk's VMDK backing: "[DatastoreName] folder/disk.vmdk"
            String datastore = extractDatastoreFromDisks(detail.path("disks"));

            // Tools status via dedicated endpoint
            String toolsStatus = fetchToolsStatus(client, sessionToken, vmId);

            String ipv4 = null;
            String ipv6 = null;
            for (JsonNode nic : guest.path("ip_addresses")) {
                String ip = nic.path("ip_address").asText(null);
                if (ip != null && ip.contains(".") && ipv4 == null) ipv4 = ip;
                if (ip != null && ip.contains(":") && ipv6 == null) ipv6 = ip;
            }

            return new VmData(hostname, fqdn, vmName, vmId,
                    vmToCluster.get(vmId), vmToDatacenter.get(vmId), datastore,
                    cpuCount, cpuCores, memoryMb, memoryGb, diskGb,
                    powerState, guestOs, toolsStatus, ipv4, ipv6);
        } catch (Exception e) {
            log.warn("Failed to fetch details for VM {}: {}", vmId, e.getMessage());
            return new VmData(vmName.toLowerCase(), null, vmName, vmId,
                    vmToCluster.get(vmId), vmToDatacenter.get(vmId), null,
                    null, null, null, null, null, powerState, null, null, null, null);
        }
    }

    /**
     * Sums all disk capacities (bytes) and converts to GB.
     * vSphere returns disks as a JSON object keyed by disk key (e.g., "2000", "2001").
     */
    private Integer extractDiskGb(JsonNode disks) {
        if (disks == null || disks.isMissingNode() || !disks.isObject()) return null;
        long totalBytes = 0;
        boolean hasDisks = false;
        var fields = disks.fields();
        while (fields.hasNext()) {
            JsonNode disk = fields.next().getValue();
            if (disk.has("capacity")) {
                totalBytes += disk.path("capacity").asLong();
                hasDisks = true;
            }
        }
        return hasDisks ? (int) (totalBytes / (1024L * 1024 * 1024)) : null;
    }

    /**
     * Extracts the datastore name from the first disk's VMDK backing file path.
     * Example: "[DatastoreName] vm-folder/vm-disk.vmdk" → "DatastoreName"
     */
    private String extractDatastoreFromDisks(JsonNode disks) {
        if (disks == null || disks.isMissingNode() || !disks.isObject()) return null;
        var fields = disks.fields();
        while (fields.hasNext()) {
            JsonNode disk = fields.next().getValue();
            String vmdkFile = disk.path("backing").path("vmdk_file").asText(null);
            if (vmdkFile != null && vmdkFile.startsWith("[")) {
                int end = vmdkFile.indexOf("]");
                if (end > 1) return vmdkFile.substring(1, end);
            }
        }
        return null;
    }

    /**
     * Fetches VMware Tools state and maps it to the schema's allowed values:
     * toolsOk | toolsOld | toolsNotRunning | toolsNotInstalled
     */
    private String fetchToolsStatus(RestClient client, String sessionToken, String vmId) {
        try {
            String toolsJson = client.get()
                    .uri("/rest/vcenter/vm/" + vmId + "/tools")
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            JsonNode tools = objectMapper.readTree(toolsJson).path("value");
            String runState = tools.path("run_state").asText(null);
            if ("NOT_INSTALLED".equals(runState)) return "toolsNotInstalled";
            if ("NOT_RUNNING".equals(runState)) return "toolsNotRunning";
            if ("RUNNING".equals(runState)) {
                String versionStatus = tools.path("version_status").asText("");
                return "UP_TO_DATE".equals(versionStatus) ? "toolsOk" : "toolsOld";
            }
        } catch (Exception e) {
            log.debug("Could not fetch tools status for VM {}: {}", vmId, e.getMessage());
        }
        return null;
    }

    private String basicAuth(String username, String password) {
        String credentials = username + ":" + password;
        return "Basic " + java.util.Base64.getEncoder().encodeToString(credentials.getBytes());
    }
}
