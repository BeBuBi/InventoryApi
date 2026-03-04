package com.example.inventorysystem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class InventoryRequest {

    @NotBlank
    private String hostname;

    @NotBlank
    private String ipAddress;

    @NotBlank
    @Pattern(regexp = "server|vm|container|network")
    private String assetType;

    @NotBlank
    @Pattern(regexp = "production|staging|dev|dr")
    private String environment;

    private String owner;
    private String location;

    @Pattern(regexp = "active|maintenance|decommissioned|unknown")
    private String status;

    private String warrantyExpiry;
    private String lastPatchedAt;
}
