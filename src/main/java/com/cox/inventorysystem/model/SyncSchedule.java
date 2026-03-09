package com.cox.inventorysystem.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "sync_schedule")
@Getter
@Setter
public class SyncSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Long id;

    @Column(name = "service", nullable = false, unique = true)
    private String service;

    @Column(name = "cron_expr", nullable = false)
    private String cronExpr;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "description")
    private String description;

    @Column(name = "last_run_at")
    private String lastRunAt;

    @Column(name = "updated_at", nullable = false)
    private String updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now().toString();
    }
}
