package com.example.inventorysystem.service;

import com.example.inventorysystem.dto.CredentialRequest;
import com.example.inventorysystem.dto.CredentialResponse;
import com.example.inventorysystem.exception.ResourceAlreadyExistsException;
import com.example.inventorysystem.exception.ResourceNotFoundException;
import com.example.inventorysystem.model.Credential;
import com.example.inventorysystem.repository.CredentialRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CredentialService {

    private final CredentialRepository credentialRepository;
    private final EncryptionService encryptionService;

    public List<CredentialResponse> listByService(String service) {
        return credentialRepository.findByService(service)
                .stream()
                .map(CredentialResponse::new)
                .toList();
    }

    public CredentialResponse getById(Long id) {
        return new CredentialResponse(findOrThrow(id));
    }

    @Transactional
    public CredentialResponse create(CredentialRequest req) {
        if (credentialRepository.existsByServiceAndName(req.getService(), req.getName())) {
            throw new ResourceAlreadyExistsException(
                    "Credential already exists: " + req.getService() + "/" + req.getName());
        }
        Credential c = new Credential();
        c.setService(req.getService());
        c.setName(req.getName());
        c.setConfig(encryptionService.encrypt(req.getConfig()));
        c.setEnabled(true);
        return new CredentialResponse(credentialRepository.save(c));
    }

    @Transactional
    public CredentialResponse update(Long id, CredentialRequest req) {
        Credential c = findOrThrow(id);
        c.setService(req.getService());
        c.setName(req.getName());
        c.setConfig(encryptionService.encrypt(req.getConfig()));
        return new CredentialResponse(credentialRepository.save(c));
    }

    @Transactional
    public CredentialResponse setEnabled(Long id, boolean enabled) {
        Credential c = findOrThrow(id);
        c.setEnabled(enabled);
        return new CredentialResponse(credentialRepository.save(c));
    }

    @Transactional
    public void delete(Long id) {
        if (!credentialRepository.existsById(id)) {
            throw new ResourceNotFoundException("Credential not found: " + id);
        }
        credentialRepository.deleteById(id);
    }

    public String getDecryptedConfig(Long id) {
        Credential c = findOrThrow(id);
        return encryptionService.decrypt(c.getConfig());
    }

    private Credential findOrThrow(Long id) {
        return credentialRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Credential not found: " + id));
    }
}
