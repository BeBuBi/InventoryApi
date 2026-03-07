package com.example.inventorysystem.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "vsphere")
@Getter
@Setter
public class Vsphere {

    @Id
    @Column(name = "hostname", nullable = false)
    private String hostname;

    @Column(name = "fqdn")
    private String fqdn;

    @Column(name = "vm_name", nullable = false)
    private String vmName;

    @Column(name = "vm_id", nullable = false, unique = true)
    private String vmId;

    @Column(name = "datacenter")
    private String datacenter;

    @Column(name = "datastore")
    private String datastore;

    @Column(name = "cpu_count")
    private Integer cpuCount;

    @Column(name = "cpu_cores")
    private Integer cpuCores;

    @Column(name = "memory_mb")
    private Integer memoryMb;

    @Column(name = "memory_gb")
    private Integer memoryGb;

    @Column(name = "disk_gb")
    private Integer diskGb;

    @Column(name = "power_state")
    private String powerState;

    @Column(name = "guest_os")
    private String guestOs;

    @Column(name = "tools_status")
    private String toolsStatus;

    @Column(name = "ipv4_address")
    private String ipv4Address;

    @Column(name = "ipv6_address")
    private String ipv6Address;

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
