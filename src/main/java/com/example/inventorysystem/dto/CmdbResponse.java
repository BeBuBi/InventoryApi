package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.Cmdb;
import lombok.Getter;

@Getter
public class CmdbResponse {

    private final String hostname;
    private final String sysId;
    private final String os;
    private final String osVersion;
    private final String ipAddress;
    private final String location;
    private final String department;
    private final String environment;
    private final String operationalStatus;
    private final String classification;
    private final String lastSyncedAt;
    private final String createdAt;
    private final String updatedAt;

    public CmdbResponse(Cmdb c) {
        this.hostname          = c.getHostname();
        this.sysId             = c.getSysId();
        this.os                = c.getOs();
        this.osVersion         = c.getOsVersion();
        this.ipAddress         = c.getIpAddress();
        this.location          = c.getLocation();
        this.department        = c.getDepartment();
        this.environment       = c.getEnvironment();
        this.operationalStatus = c.getOperationalStatus();
        this.classification    = c.getClassification();
        this.lastSyncedAt      = c.getLastSyncedAt();
        this.createdAt         = c.getCreatedAt();
        this.updatedAt         = c.getUpdatedAt();
    }
}
