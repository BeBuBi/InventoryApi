package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.Inventory;
import lombok.Getter;



@Getter
public class InventoryResponse {

    private final String hostname;
    private final String ipAddress;
    private final String assetType;
    private final String environment;
    private final String owner;
    private final String location;
    private final String status;
    private final String warrantyExpiry;
    private final String lastPatchedAt;
    private final String createdAt;
    private final String updatedAt;

    public InventoryResponse(Inventory inv) {
        this.hostname = inv.getHostname();
        this.ipAddress = inv.getIpAddress();
        this.assetType = inv.getAssetType();
        this.environment = inv.getEnvironment();
        this.owner = inv.getOwner();
        this.location = inv.getLocation();
        this.status = inv.getStatus();
        this.warrantyExpiry = inv.getWarrantyExpiry();
        this.lastPatchedAt = inv.getLastPatchedAt();
        this.createdAt = inv.getCreatedAt();
        this.updatedAt = inv.getUpdatedAt();
    }
}
