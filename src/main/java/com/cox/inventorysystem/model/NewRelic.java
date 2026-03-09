package com.cox.inventorysystem.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "newrelic")
@Getter
@Setter
public class NewRelic {

    @Id
    @Column(name = "hostname", nullable = false)
    private String hostname;

    @Column(name = "full_hostname")
    private String fullHostname;

    @Column(name = "ipv4_address")
    private String ipv4Address;

    @Column(name = "ipv6_address")
    private String ipv6Address;

    @Column(name = "processor_count")
    private Integer processorCount;

    @Column(name = "core_count")
    private Integer coreCount;

    /** Raw bytes as reported by New Relic systemMemoryBytes attribute. */
    @Column(name = "system_memory_bytes")
    private Long systemMemoryBytes;

    @Column(name = "linux_distribution")
    private String linuxDistribution;

    @Column(name = "service")
    private String service;

    @Column(name = "environment")
    private String environment;

    @Column(name = "team")
    private String team;

    @Column(name = "location")
    private String location;

    @Column(name = "account_id")
    private String accountId;

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
