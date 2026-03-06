package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.Credential;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;

import java.util.Collections;
import java.util.Map;
import java.util.Set;

@Getter
public class CredentialResponse {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> MASKED_KEYS = Set.of("password", "apiKey");

    private final Long id;
    private final String service;
    private final String name;
    private final boolean enabled;
    private final String createdAt;
    private final String updatedAt;
    private final Map<String, String> config;

    public CredentialResponse(Credential c) {
        this(c, null);
    }

    public CredentialResponse(Credential c, String decryptedConfig) {
        this.id = c.getId();
        this.service = c.getService();
        this.name = c.getName();
        this.enabled = c.isEnabled();
        this.createdAt = c.getCreatedAt();
        this.updatedAt = c.getUpdatedAt();
        this.config = parseConfig(decryptedConfig);
    }

    private static Map<String, String> parseConfig(String json) {
        if (json == null || json.isBlank()) return Collections.emptyMap();
        try {
            Map<String, String> raw = MAPPER.readValue(json, new TypeReference<>() {});
            raw.replaceAll((k, v) -> MASKED_KEYS.contains(k) ? "********" : v);
            return raw;
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }
}
