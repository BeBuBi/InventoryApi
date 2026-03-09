package com.example.inventorysystem.controller;

import com.example.inventorysystem.dto.CredentialRequest;
import com.example.inventorysystem.dto.CredentialResponse;
import com.example.inventorysystem.service.CredentialService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settings/credentials")
@RequiredArgsConstructor
public class CredentialController {

    private final CredentialService credentialService;

    @GetMapping
    public List<CredentialResponse> listByService(@RequestParam String service) {
        return credentialService.listByService(service);
    }

    @GetMapping("/{id}")
    public CredentialResponse getById(@PathVariable Long id) {
        return credentialService.getById(id);
    }

    @PostMapping
    public ResponseEntity<CredentialResponse> create(@Valid @RequestBody CredentialRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(credentialService.create(req));
    }

    @PutMapping("/{id}")
    public CredentialResponse update(@PathVariable Long id,
                                     @Valid @RequestBody CredentialRequest req) {
        return credentialService.update(id, req);
    }

    @PatchMapping("/{id}/enable")
    public CredentialResponse enable(@PathVariable Long id) {
        return credentialService.setEnabled(id, true);
    }

    @PatchMapping("/{id}/disable")
    public CredentialResponse disable(@PathVariable Long id) {
        return credentialService.setEnabled(id, false);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        credentialService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
