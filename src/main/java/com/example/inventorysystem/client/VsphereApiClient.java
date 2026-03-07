package com.example.inventorysystem.client;

import com.example.inventorysystem.service.CredentialService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.net.ssl.*;
import java.security.cert.X509Certificate;
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
            String datacenter, String datastore,
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
                .requestFactory(trustAllRequestFactory())
                .build();

        // Authenticate — obtain session token (vSphere 8.x /api/session returns a plain JSON string)
        String sessionTokenRaw = client.post()
                .uri("/api/session")
                .header("Authorization", basicAuth(username, password))
                .retrieve()
                .body(String.class);

        if (sessionTokenRaw == null) {
            throw new RuntimeException("Failed to obtain vSphere session token from " + host);
        }
        // /api/session returns the token as a quoted JSON string, e.g. "abc123"
        String sessionToken = objectMapper.readTree(sessionTokenRaw).asText();
        log.info("vSphere session token obtained from {}: length={}", host, sessionToken.length());

        // Pre-fetch datacenter id→name map (MoRef ID → display name)
        Map<String, String> datacenterNames = buildIdToNameMap(client, sessionToken, "/api/vcenter/datacenter", "datacenter");

        // Fetch VM list
        String vmsJson = client.get()
                .uri("/api/vcenter/vm")
                .header("vmware-api-session-id", sessionToken)
                .retrieve()
                .body(String.class);

        List<VmData> result = new ArrayList<>();
        JsonNode vms = objectMapper.readTree(vmsJson);
        for (JsonNode vm : vms) {
            result.add(mapVm(vm, client, sessionToken, datacenterNames));
        }

        log.info("vSphere sync: fetched {} VMs from {}", result.size(), host);
        return result;
    }

    /**
     * Builds a MoRef ID → display name map from a vSphere list endpoint.
     * Each item in the response array is expected to have an idField (e.g. "datacenter") and a "name" field.
     */
    private Map<String, String> buildIdToNameMap(RestClient client, String sessionToken,
                                                  String uri, String idField) {
        Map<String, String> map = new HashMap<>();
        try {
            String json = client.get()
                    .uri(uri)
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            for (JsonNode item : objectMapper.readTree(json)) {
                String id = item.path(idField).asText(null);
                String name = item.path("name").asText(null);
                if (id != null && name != null) map.put(id, name);
            }
        } catch (Exception e) {
            log.warn("Failed to fetch {} name map: {}", idField, e.getMessage());
        }
        return map;
    }

    private VmData mapVm(JsonNode vm, RestClient client, String sessionToken,
                         Map<String, String> datacenterNames) {
        String vmId = vm.path("vm").asText();
        String vmName = vm.path("name").asText();
        String powerState = normalizePowerState(vm.path("power_state").asText(null));

        // Fetch VM details for full hardware info
        try {
            String detailJson = client.get()
                    .uri("/api/vcenter/vm/" + vmId)
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);

            JsonNode detail = objectMapper.readTree(detailJson);
            JsonNode placement = detail.path("placement");

            // Resolve datacenter name from placement MoRef ID
            String datacenterName = datacenterNames.get(placement.path("datacenter").asText(null));

            // Guest hostname from identity endpoint (separate call in vSphere 8.x)
            String guestHostname = fetchGuestHostname(client, sessionToken, vmId);
            String fqdn = (guestHostname != null && guestHostname.contains(".")) ? guestHostname : null;
            String hostname = guestHostname != null
                    ? guestHostname.split("\\.")[0].toLowerCase()
                    : vmName.toLowerCase();

            // vSphere 8.x: cpu/memory are top-level objects, not under "hardware"
            String guestOs = detail.path("guest_OS").asText(null);
            JsonNode cpu = detail.path("cpu");
            JsonNode memory = detail.path("memory");
            Integer cpuCount = cpu.path("count").isInt() ? cpu.path("count").asInt() : null;
            Integer cpuCores = cpu.path("cores_per_socket").isInt() ? cpu.path("cores_per_socket").asInt() : null;
            Integer memoryMb = memory.path("size_MiB").isInt() ? memory.path("size_MiB").asInt() : null;
            Integer memoryGb = memoryMb != null ? memoryMb / 1024 : null;

            // Sum all disk capacities (bytes → GB); API returns disks as an object keyed by disk key
            Integer diskGb = extractDiskGb(detail.path("disks"));
            // Extract datastore name from first disk's VMDK backing: "[DatastoreName] folder/disk.vmdk"
            String datastore = extractDatastoreFromDisks(detail.path("disks"));

            // Tools status via dedicated endpoint
            String toolsStatus = fetchToolsStatus(client, sessionToken, vmId);

            // vSphere 8.x: IPs come from the guest networking interfaces endpoint
            String[] ips = fetchIpAddresses(client, sessionToken, vmId);
            String ipv4 = ips[0];
            String ipv6 = ips[1];

            return new VmData(hostname, fqdn, vmName, vmId,
                    datacenterName, datastore,
                    cpuCount, cpuCores, memoryMb, memoryGb, diskGb,
                    powerState, guestOs, toolsStatus, ipv4, ipv6);
        } catch (Exception e) {
            log.warn("Failed to fetch details for VM {}: {}", vmId, e.getMessage());
            return new VmData(vmName.toLowerCase(), null, vmName, vmId,
                    null, null,
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
                    .uri("/api/vcenter/vm/" + vmId + "/tools")
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            JsonNode tools = objectMapper.readTree(toolsJson);
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

    /**
     * Fetches the guest hostname from the vSphere 8.x guest identity endpoint.
     * Returns null if tools are not running or the call fails.
     */
    private String fetchGuestHostname(RestClient client, String sessionToken, String vmId) {
        try {
            String json = client.get()
                    .uri("/api/vcenter/vm/" + vmId + "/guest/identity")
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(json).path("host_name").asText(null);
        } catch (Exception e) {
            log.debug("Could not fetch guest identity for VM {}: {}", vmId, e.getMessage());
            return null;
        }
    }

    /**
     * Fetches all IPv4 and IPv6 addresses from the vSphere 8.x guest networking interfaces endpoint.
     * Returns [ipv4s, ipv6s] where each element is a comma-separated string of all addresses of that
     * type, or null if none were found. Link-local IPv6 addresses (fe80:) are excluded.
     */
    private String[] fetchIpAddresses(RestClient client, String sessionToken, String vmId) {
        List<String> ipv4s = new ArrayList<>();
        List<String> ipv6s = new ArrayList<>();
        try {
            String json = client.get()
                    .uri("/api/vcenter/vm/" + vmId + "/guest/networking/interfaces")
                    .header("vmware-api-session-id", sessionToken)
                    .retrieve()
                    .body(String.class);
            for (JsonNode iface : objectMapper.readTree(json)) {
                for (JsonNode addr : iface.path("ip").path("ip_addresses")) {
                    String ip = addr.path("ip_address").asText(null);
                    if (ip == null) continue;
                    if (ip.contains(".")) {
                        ipv4s.add(ip);
                    } else if (ip.contains(":") && !ip.toLowerCase().startsWith("fe80:")) {
                        ipv6s.add(ip);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch networking interfaces for VM {}: {}", vmId, e.getMessage());
        }
        String ipv4 = ipv4s.isEmpty() ? null : String.join(",", ipv4s);
        String ipv6 = ipv6s.isEmpty() ? null : String.join(",", ipv6s);
        return new String[]{ipv4, ipv6};
    }

    /** Maps vSphere 8.x uppercase power state values to schema-expected camelCase. */
    private String normalizePowerState(String raw) {
        if (raw == null) return null;
        return switch (raw) {
            case "POWERED_ON"  -> "poweredOn";
            case "POWERED_OFF" -> "poweredOff";
            case "SUSPENDED"   -> "suspended";
            default            -> raw;
        };
    }

    private String basicAuth(String username, String password) {
        String credentials = username + ":" + password;
        return "Basic " + java.util.Base64.getEncoder().encodeToString(credentials.getBytes());
    }

    /** Returns a request factory that trusts all SSL certificates (for internal/self-signed certs). */
    private static SimpleClientHttpRequestFactory trustAllRequestFactory() {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] c, String a) {}
                    public void checkServerTrusted(X509Certificate[] c, String a) {}
                }
            };
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, trustAll, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(ctx.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((host, session) -> true);
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(10_000);
            factory.setReadTimeout(60_000);
            return factory;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create trust-all SSL factory", e);
        }
    }
}
