package com.cox.inventorysystem.dto;

import com.cox.inventorysystem.model.SyncSchedule;
import lombok.Getter;



@Getter
public class SyncScheduleResponse {

    private final Long id;
    private final String service;
    private final String cronExpr;
    private final boolean enabled;
    private final String description;
    private final String lastRunAt;
    private final String updatedAt;

    public SyncScheduleResponse(SyncSchedule s) {
        this.id = s.getId();
        this.service = s.getService();
        this.cronExpr = s.getCronExpr();
        this.enabled = s.isEnabled();
        this.description = s.getDescription();
        this.lastRunAt = s.getLastRunAt();
        this.updatedAt = s.getUpdatedAt();
    }
}
