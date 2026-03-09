package com.cox.inventorysystem.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "cmdb")
@Getter
@Setter
public class Cmdb {

    @Id
    @Column(name = "hostname", nullable = false)
    private String hostname;

    @Column(name = "sys_id")
    private String sysId;

    @Column(name = "os")
    private String os;

    @Column(name = "os_version")
    private String osVersion;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "location")
    private String location;

    @Column(name = "department")
    private String department;

    @Column(name = "environment")
    private String environment;

    @Column(name = "operational_status")
    private String operationalStatus;

    @Column(name = "classification")
    private String classification;

    @Column(name = "last_synced_at")
    private String lastSyncedAt;

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
