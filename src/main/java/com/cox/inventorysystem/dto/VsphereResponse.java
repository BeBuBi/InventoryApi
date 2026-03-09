package com.cox.inventorysystem.dto;

import com.cox.inventorysystem.model.Vsphere;
import lombok.Getter;



@Getter
public class VsphereResponse {

    private final String hostname;
    private final String vmName;
    private final Integer cpuCount;
    private final Integer cpuCores;
    private final Integer memoryMb;
    private final Integer memoryGb;
    private final String powerState;
    private final String guestOs;
    private final String toolsStatus;
    private final String ipv4Address;
    private final String ipv6Address;
    private final String sourceUrl;
    private final String lastSyncedAt;
    private final String createdAt;
    private final String updatedAt;

    public VsphereResponse(Vsphere v) {
        this.hostname = v.getHostname();
        this.vmName = v.getVmName();
        this.cpuCount = v.getCpuCount();
        this.cpuCores = v.getCpuCores();
        this.memoryMb = v.getMemoryMb();
        this.memoryGb = v.getMemoryGb();
        this.powerState = v.getPowerState();
        this.guestOs = v.getGuestOs();
        this.toolsStatus = v.getToolsStatus();
        this.ipv4Address = v.getIpv4Address();
        this.ipv6Address = v.getIpv6Address();
        this.sourceUrl = v.getSourceUrl();
        this.lastSyncedAt = v.getLastSyncedAt();
        this.createdAt = v.getCreatedAt();
        this.updatedAt = v.getUpdatedAt();
    }
}
