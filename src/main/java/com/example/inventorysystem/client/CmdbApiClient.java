package com.example.inventorysystem.client;

import com.example.inventorysystem.service.CredentialService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import javax.net.ssl.*;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class CmdbApiClient {

    private static final String SNOW_BASE_URL = "https://coxprod.service-now.com";

    private final CredentialService credentialService;
    private final ObjectMapper objectMapper;

    public record AssetData(
            String hostname, String sysId, String assetTag, String serialNumber,
            String manufacturer, String modelName, String os, String osVersion,
            String ipAddress, String location, String department, String environment,
            String operationalStatus, String classification
    ) {}

    public List<AssetData> fetchAllAssets(String credentialId) throws Exception {
        Long id = Long.parseLong(credentialId);
        String configJson = credentialService.getDecryptedConfig(id);
        JsonNode config = objectMapper.readTree(configJson);

        String clientId     = config.get("client_id").asText();
        String clientSecret = config.get("client_secret").asText();
        String username     = config.get("username").asText();
        String password     = config.get("password").asText();

        RestClient client = RestClient.builder()
                .baseUrl(SNOW_BASE_URL)
                .requestFactory(trustAllRequestFactory())
                .build();

        // Obtain OAuth2 token via password grant
        MultiValueMap<String, String> tokenForm = new LinkedMultiValueMap<>();
        tokenForm.add("grant_type",    "password");
        tokenForm.add("client_id",     clientId);
        tokenForm.add("client_secret", clientSecret);
        tokenForm.add("username",      username);
        tokenForm.add("password",      password);

        String tokenResponseJson = client.post()
                .uri("/oauth_token.do")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(tokenForm)
                .retrieve()
                .body(String.class);

        if (tokenResponseJson == null) {
            throw new RuntimeException("Empty token response from ServiceNow");
        }

        JsonNode tokenNode = objectMapper.readTree(tokenResponseJson);
        String accessToken = tokenNode.path("access_token").asText(null);
        if (accessToken == null || accessToken.isBlank()) {
            throw new RuntimeException("Failed to obtain access_token from ServiceNow: " + tokenResponseJson);
        }
        log.info("ServiceNow OAuth token obtained, length={}", accessToken.length());

        // Fetch CMDB asset details
        String responseJson = client.get()
                .uri("/api/xci/cmdb_asset/getAssetDetails")
                .header("Authorization", "Bearer " + accessToken)
                .header("Accept", "application/json")
                .retrieve()
                .body(String.class);

        if (responseJson == null) {
            throw new RuntimeException("Empty response from ServiceNow CMDB endpoint");
        }

        JsonNode root = objectMapper.readTree(responseJson);
        JsonNode results = root.path("result");

        List<AssetData> assets = new ArrayList<>();
        for (JsonNode record : results) {
            try {
                AssetData asset = mapRecord(record);
                if (asset != null) {
                    assets.add(asset);
                }
            } catch (Exception e) {
                log.warn("Failed to map CMDB record: {}", e.getMessage());
            }
        }

        log.info("ServiceNow CMDB sync: fetched {} assets", assets.size());
        return assets;
    }

    private AssetData mapRecord(JsonNode record) {
        // Resolve hostname from multiple candidate fields, strip domain suffix
        String rawHostname = extractField(record, "name", "u_hostname", "host_name");
        if (rawHostname == null || rawHostname.isBlank()) {
            return null;
        }
        String hostname = rawHostname.split("\\.")[0].toLowerCase();
        if (hostname.isBlank()) {
            return null;
        }

        String sysId            = extractField(record, "sys_id");
        String assetTag         = extractField(record, "asset_tag");
        String serialNumber     = extractField(record, "serial_number", "serial_no");
        String manufacturer     = extractField(record, "manufacturer");
        String modelName        = extractField(record, "model_id", "model_number");
        String os               = extractField(record, "os", "os_type");
        String osVersion        = extractField(record, "os_version");
        String ipAddress        = extractField(record, "ip_address");
        String location         = extractField(record, "location");
        String department       = extractField(record, "department");
        String environment      = extractField(record, "u_environment", "environment");
        String operationalStatus = extractField(record, "operational_status");
        String classification   = extractField(record, "classification", "subcategory");

        return new AssetData(
                hostname, sysId, assetTag, serialNumber,
                manufacturer, modelName, os, osVersion,
                ipAddress, location, department, environment,
                operationalStatus, classification
        );
    }

    /**
     * Tries each key in order and returns the first non-null, non-empty value.
     * For reference fields (objects with display_value), extracts the display_value string.
     */
    private String extractField(JsonNode record, String... keys) {
        for (String key : keys) {
            JsonNode node = record.path(key);
            if (node.isMissingNode() || node.isNull()) continue;

            String value;
            if (node.isObject()) {
                // ServiceNow reference field: {"display_value": "...", "value": "..."}
                JsonNode dv = node.path("display_value");
                if (!dv.isMissingNode() && !dv.isNull()) {
                    value = dv.asText(null);
                } else {
                    value = node.path("value").asText(null);
                }
            } else {
                value = node.asText(null);
            }

            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
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
