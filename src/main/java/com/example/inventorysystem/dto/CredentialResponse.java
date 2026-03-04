package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.Credential;
import lombok.Getter;



@Getter
public class CredentialResponse {

    private final Long id;
    private final String service;
    private final String name;
    private final boolean enabled;
    private final String createdAt;
    private final String updatedAt;

    public CredentialResponse(Credential c) {
        this.id = c.getId();
        this.service = c.getService();
        this.name = c.getName();
        this.enabled = c.isEnabled();
        this.createdAt = c.getCreatedAt();
        this.updatedAt = c.getUpdatedAt();
    }
}
