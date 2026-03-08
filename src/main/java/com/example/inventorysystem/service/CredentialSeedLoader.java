package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.CredentialRequest;
import com.example.inventorysystem.repository.CredentialRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class CredentialSeedLoader {

    private static final String SEED_FILE = "credentials-seed.json";

    private final CredentialRepository credentialRepository;
    private final CredentialService credentialService;
    private final ObjectMapper objectMapper;

    @EventListener(ApplicationReadyEvent.class)
    public void loadSeeds() {
        ClassPathResource resource = new ClassPathResource(SEED_FILE);
        if (!resource.exists()) {
            log.debug("No credentials-seed.json found on classpath — skipping seed load");
            return;
        }

        try {
            JsonNode seeds = objectMapper.readTree(resource.getInputStream());
            int loaded = 0;
            for (JsonNode seed : seeds) {
                String service = seed.path("service").asText();
                String name = seed.path("name").asText();
                String config = seed.path("config").asText();

                if (service.isBlank() || name.isBlank() || config.isBlank()) {
                    log.warn("Skipping malformed seed entry (missing service/name/config)");
                    continue;
                }

                if (credentialRepository.existsByServiceAndName(service, name)) {
                    log.debug("Credential already exists: {}/{} — skipping", service, name);
                    continue;
                }

                CredentialRequest req = new CredentialRequest();
                req.setService(service);
                req.setName(name);
                req.setConfig(config);
                credentialService.create(req);
                log.info("Seeded credential: {}/{}", service, name);
                loaded++;
            }
            if (loaded > 0) {
                log.info("Credential seed complete — loaded {} credential(s)", loaded);
            }
        } catch (Exception e) {
            log.error("Failed to load credentials-seed.json: {}", e.getMessage());
        }
    }
}
