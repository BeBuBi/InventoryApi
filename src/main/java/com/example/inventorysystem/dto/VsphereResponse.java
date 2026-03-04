package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.Vsphere;
import lombok.Getter;



@Getter
public class VsphereResponse {

    private final String hostname;
    private final String fqdn;
    private final String vmName;
    private final String vmId;
    private final String cluster;
    private final String datacenter;
    private final String datastore;
    private final Integer cpuCount;
    private final Integer cpuCores;
    private final Integer memoryMb;
    private final Integer memoryGb;
    private final Integer diskGb;
    private final String powerState;
    private final String guestOs;
    private final String toolsStatus;
    private final String ipv4Address;
    private final String ipv6Address;
    private final String lastSyncedAt;
    private final String createdAt;
    private final String updatedAt;

    public VsphereResponse(Vsphere v) {
        this.hostname = v.getHostname();
        this.fqdn = v.getFqdn();
        this.vmName = v.getVmName();
        this.vmId = v.getVmId();
        this.cluster = v.getCluster();
        this.datacenter = v.getDatacenter();
        this.datastore = v.getDatastore();
        this.cpuCount = v.getCpuCount();
        this.cpuCores = v.getCpuCores();
        this.memoryMb = v.getMemoryMb();
        this.memoryGb = v.getMemoryGb();
        this.diskGb = v.getDiskGb();
        this.powerState = v.getPowerState();
        this.guestOs = v.getGuestOs();
        this.toolsStatus = v.getToolsStatus();
        this.ipv4Address = v.getIpv4Address();
        this.ipv6Address = v.getIpv6Address();
        this.lastSyncedAt = v.getLastSyncedAt();
        this.createdAt = v.getCreatedAt();
        this.updatedAt = v.getUpdatedAt();
    }
}
