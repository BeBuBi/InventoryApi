package com.cox.inventorysystem.service;

import org.springframework.stereotype.Service;

/**
 * No-op implementation — credentials are stored as plain text.
 * Encryption can be re-enabled here in a future iteration without
 * changing any callers in CredentialService.
 */
@Service
public class EncryptionService {

    public String encrypt(String plaintext) {
        return plaintext;
    }

    public String decrypt(String value) {
        return value;
    }
}
