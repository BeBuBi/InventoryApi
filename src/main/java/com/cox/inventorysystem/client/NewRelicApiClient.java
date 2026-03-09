package com.cox.inventorysystem.client;

import com.cox.inventorysystem.service.CredentialService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class NewRelicApiClient {

    private static final String NERDGRAPH_URL = "https://api.newrelic.com/graphql";

    private final CredentialService credentialService;
    private final ObjectMapper objectMapper;

    public record HostData(
            String hostname, String fullHostname,
            String ipv4Address, String ipv6Address,
            Integer processorCount, Integer coreCount, Long systemMemoryBytes,
            String linuxDistribution, String service, String environment,
            String team, String location, String accountId
    ) {}

    public List<HostData> fetchAllHosts(String credentialId) throws Exception {
        Long id = Long.parseLong(credentialId);
        String configJson = credentialService.getDecryptedConfig(id);
        JsonNode config = objectMapper.readTree(configJson);

        String apiKey = config.get("apiKey").asText();
        String accountId = config.get("accountId").asText();

        // Fetch NetworkSample (IP/network fields) and SystemSample (hardware fields) in one request.
        String query = """
                {
                  actor {
                    account(id: %s) {
                      network: nrql(query: "SELECT * FROM NetworkSample LIMIT MAX SINCE 1 day ago") {
                        results
                      }
                      system: nrql(query: "SELECT latest(processorCount), latest(coreCount), latest(systemMemoryBytes), latest(linuxDistribution) FROM SystemSample FACET hostname LIMIT MAX SINCE 1 day ago") {
                        results
                      }
                    }
                  }
                }
                """.formatted(accountId);

        String requestBody = objectMapper.writeValueAsString(
                objectMapper.createObjectNode().put("query", query));

        String responseJson;
        try {
            responseJson = RestClient.create(NERDGRAPH_URL)
                    .post()
                    .header("Api-Key", apiKey)
                    .header("Content-Type", "application/json")
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException ex) {
            log.error("New Relic API call failed — HTTP {} {}: {}",
                    ex.getStatusCode().value(), ex.getStatusText(),
                    ex.getResponseBodyAsString());
            throw ex;
        }

        // NerdGraph always returns HTTP 200; auth/query errors appear in the errors array
        JsonNode root = objectMapper.readTree(responseJson);
        if (root.has("errors")) {
            log.error("New Relic NerdGraph errors for account {}: {}", accountId, root.get("errors"));
            throw new IllegalStateException("NerdGraph returned errors: " + root.get("errors"));
        }

        JsonNode account = root.path("data").path("actor").path("account");

        JsonNode networkRows = account.path("network").path("results");
        JsonNode systemRows  = account.path("system").path("results");

        // Build a hostname -> SystemSample lookup map
        Map<String, JsonNode> systemByHostname = new LinkedHashMap<>();
        for (JsonNode row : systemRows) {
            String h = row.path("hostname").asText(null);
            if (h != null) systemByHostname.put(h.split("\\.")[0].toLowerCase(), row);
        }

        // Group NetworkSample rows by hostname
        Map<String, List<JsonNode>> byHostname = new LinkedHashMap<>();
        for (JsonNode row : networkRows) {
            String hostname = row.path("hostname").asText(null);
            if (hostname != null) {
                byHostname.computeIfAbsent(hostname, k -> new ArrayList<>()).add(row);
            }
        }

        List<HostData> result = new ArrayList<>();
        for (List<JsonNode> interfaceRows : byHostname.values()) {
            HostData host = mergeInterfaceRows(interfaceRows, accountId, systemByHostname);
            if (host != null) result.add(host);
        }

        log.info("New Relic sync: fetched {} hosts ({} network rows, {} system rows) for account {}",
                result.size(), networkRows.size(), systemRows.size(), accountId);
        return result;
    }

    /**
     * Merges NetworkSample interface rows with a SystemSample row for a single host.
     *
     * NetworkSample emits one row per network interface; we scan all rows for the
     * best routable IP. Hardware fields (processorCount, coreCount, systemMemoryBytes,
     * linuxDistribution) come from SystemSample, looked up by short hostname.
     */
    private HostData mergeInterfaceRows(List<JsonNode> rows, String accountId,
                                        Map<String, JsonNode> systemByHostname) {
        JsonNode first = rows.get(0);

        String hostname = first.path("hostname").asText(null);
        if (hostname == null) return null;

        String fullHostname = first.path("fullHostname").asText(null);
        String shortHostname = (fullHostname != null ? fullHostname : hostname).split("\\.")[0].toLowerCase();

        // Collect all unique routable IPs across every interface row.
        // Strip subnet notation (e.g. "10.0.0.1/24" -> "10.0.0.1") before storing.
        Set<String> ipv4Set = new LinkedHashSet<>();
        Set<String> ipv6Set = new LinkedHashSet<>();
        for (JsonNode row : rows) {
            String ip4 = stripSubnet(row.path("ipV4Address").asText(null));
            if (ip4 != null && !ip4.startsWith("127.") && !ip4.startsWith("169.254.")) ipv4Set.add(ip4);

            String ip6 = stripSubnet(row.path("ipV6Address").asText(null));
            if (ip6 != null && !ip6.isBlank() && !"::1".equals(ip6)) ipv6Set.add(ip6);
        }
        String ipv4 = ipv4Set.isEmpty() ? null : String.join(",", ipv4Set);
        String ipv6 = ipv6Set.isEmpty() ? null : String.join(",", ipv6Set);

        // Pull hardware fields from SystemSample if available
        JsonNode sys = systemByHostname.get(shortHostname);
        Integer processorCount   = sys != null && sys.hasNonNull("latest.processorCount")   ? sys.get("latest.processorCount").asInt()     : null;
        Integer coreCount        = sys != null && sys.hasNonNull("latest.coreCount")        ? sys.get("latest.coreCount").asInt()           : null;
        Long systemMemoryBytes   = sys != null && sys.hasNonNull("latest.systemMemoryBytes") ? sys.get("latest.systemMemoryBytes").asLong() : null;
        String linuxDistribution = sys != null ? sys.path("latest.linuxDistribution").asText(null) : null;

        return new HostData(
                shortHostname, fullHostname, ipv4, ipv6,
                processorCount, coreCount, systemMemoryBytes, linuxDistribution,
                first.path("service").asText(null),
                first.path("environment").asText(null),
                first.path("team").asText(null),
                first.path("location").asText(null),
                accountId
        );
    }

    /** Strips CIDR subnet notation from an IP address (e.g. "10.0.0.1/24" -> "10.0.0.1"). */
    private String stripSubnet(String ip) {
        if (ip == null || ip.isBlank()) return null;
        int slash = ip.indexOf('/');
        return slash >= 0 ? ip.substring(0, slash).trim() : ip.trim();
    }
}
