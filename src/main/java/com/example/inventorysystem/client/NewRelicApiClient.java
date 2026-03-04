package com.example.inventorysystem.client;

import com.example.inventorysystem.service.CredentialService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
            String team, String location
    ) {}

    public List<HostData> fetchAllHosts(String credentialId) throws Exception {
        Long id = Long.parseLong(credentialId);
        String configJson = credentialService.getDecryptedConfig(id);
        JsonNode config = objectMapper.readTree(configJson);

        String apiKey = config.get("apiKey").asText();
        String accountId = config.get("accountId").asText();

        // NetworkSample has one row per network interface per host.
        // SELECT * returns every interface row; we group and merge in Java.
        String query = """
                {
                  actor {
                    account(id: %s) {
                      infrastracture: nrql(query: "SELECT * FROM NetworkSample LIMIT MAX SINCE 1 day ago") {
                        results
                      }
                    }
                  }
                }
                """.formatted(accountId);

        String requestBody = objectMapper.writeValueAsString(
                objectMapper.createObjectNode().put("query", query));

        String responseJson = RestClient.create(NERDGRAPH_URL)
                .post()
                .header("Api-Key", apiKey)
                .header("Content-Type", "application/json")
                .body(requestBody)
                .retrieve()
                .body(String.class);

        JsonNode rows = objectMapper.readTree(responseJson)
                .path("data").path("actor").path("account")
                .path("infrastracture").path("results");

        // Group all interface rows by hostname (preserving insertion order)
        Map<String, List<JsonNode>> byHostname = new LinkedHashMap<>();
        for (JsonNode row : rows) {
            String hostname = row.path("hostname").asText(null);
            if (hostname != null) {
                byHostname.computeIfAbsent(hostname, k -> new ArrayList<>()).add(row);
            }
        }

        List<HostData> result = new ArrayList<>();
        for (List<JsonNode> interfaceRows : byHostname.values()) {
            HostData host = mergeInterfaceRows(interfaceRows);
            if (host != null) result.add(host);
        }

        log.info("New Relic sync: fetched {} hosts ({} interface rows) for account {}",
                result.size(), rows.size(), accountId);
        return result;
    }

    /**
     * Merges all NetworkSample rows for a single host into one HostData record.
     *
     * NetworkSample emits one row per network interface, so a host with multiple
     * NICs produces multiple rows. Host-level fields (fullHostname, service,
     * environment, team, location) are the same across all rows; IP fields are
     * scanned across all rows to find the best routable address.
     *
     * Fields not present in NetworkSample (processorCount, coreCount,
     * systemMemoryBytes, linuxDistribution) are stored as null.
     */
    private HostData mergeInterfaceRows(List<JsonNode> rows) {
        JsonNode first = rows.get(0);

        String hostname = first.path("hostname").asText(null);
        if (hostname == null) return null;

        // fullHostname is the FQDN reported by the NR infrastructure agent
        String fullHostname = first.path("fullHostname").asText(null);
        String shortHostname = (fullHostname != null ? fullHostname : hostname).split("\\.")[0].toLowerCase();

        // Scan every interface row for the best routable addresses.
        // NetworkSample ipV4Address/ipV6Address are single values per row.
        String ipv4 = null;
        String ipv6 = null;

        for (JsonNode row : rows) {
            if (ipv4 == null) {
                String ip4 = row.path("ipV4Address").asText(null);
                if (ip4 != null && !ip4.startsWith("127.") && !ip4.startsWith("169.254.")) {
                    ipv4 = ip4;
                }
            }
            if (ipv6 == null) {
                String ip6 = row.path("ipV6Address").asText(null);
                if (ip6 != null && !ip6.isBlank() && !"::1".equals(ip6)) {
                    ipv6 = ip6;
                }
            }
            if (ipv4 != null && ipv6 != null) break;
        }

        return new HostData(
                shortHostname,
                fullHostname,
                ipv4,
                ipv6,
                null,   // processorCount — not in NetworkSample
                null,   // coreCount      — not in NetworkSample
                null,   // systemMemoryBytes — not in NetworkSample
                null,   // linuxDistribution — not in NetworkSample
                first.path("service").asText(null),
                first.path("environment").asText(null),
                first.path("team").asText(null),
                first.path("location").asText(null)
        );
    }
}
