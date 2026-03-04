package com.example.inventorysystem.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "inventory")
@Getter
@Setter
public class Inventory {

    @Id
    @Column(name = "hostname", nullable = false)
    private String hostname;

    @Column(name = "ip_address", nullable = false)
    private String ipAddress;

    @Column(name = "asset_type", nullable = false)
    private String assetType;

    @Column(name = "environment", nullable = false)
    private String environment;

    @Column(name = "owner")
    private String owner;

    @Column(name = "location")
    private String location;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "warranty_expiry")
    private String warrantyExpiry;

    @Column(name = "last_patched_at")
    private String lastPatchedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private String createdAt;

    @Column(name = "updated_at", nullable = false)
    private String updatedAt;

    @PrePersist
    protected void onCreate() {
        String now = LocalDateTime.now().toString();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now().toString();
    }
}
