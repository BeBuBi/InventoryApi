package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.Inventory;
import lombok.Getter;

@Getter
public class InventoryResponse {

    private final String hostname;

    // vSphere fields
    private final String vsphereIpv4;
    private final String vsphereIpv6;
    private final String vmName;
    private final Integer cpuCount;
    private final Integer cpuCores;
    private final Integer memoryMb;
    private final Integer memoryGb;
    private final String powerState;
    private final String guestOs;
    private final String toolsStatus;
    private final String vsphereLastSynced;

    // New Relic fields
    private final String fullHostname;
    private final String nrIpv4;
    private final String nrIpv6;
    private final Integer processorCount;
    private final Integer coreCount;
    private final Long systemMemoryBytes;
    private final String linuxDistribution;
    private final String service;
    private final String nrEnvironment;
    private final String team;
    private final String nrLocation;
    private final String accountId;

    // CMDB fields
    private final String sysId;
    private final String os;
    private final String osVersion;
    private final String cmdbIpAddress;
    private final String cmdbLocation;
    private final String department;
    private final String cmdbEnvironment;
    private final String operationalStatus;
    private final String classification;
    private final String cmdbLastSynced;

    // Meta
    private final String sources;

    public InventoryResponse(Inventory i) {
        this.hostname = i.getHostname();
        this.vsphereIpv4 = i.getVsphereIpv4();
        this.vsphereIpv6 = i.getVsphereIpv6();
        this.vmName = i.getVmName();
        this.cpuCount = i.getCpuCount();
        this.cpuCores = i.getCpuCores();
        this.memoryMb = i.getMemoryMb();
        this.memoryGb = i.getMemoryGb();
        this.powerState = i.getPowerState();
        this.guestOs = i.getGuestOs();
        this.toolsStatus = i.getToolsStatus();
        this.vsphereLastSynced = i.getVsphereLastSynced();
        this.fullHostname = i.getFullHostname();
        this.nrIpv4 = i.getNrIpv4();
        this.nrIpv6 = i.getNrIpv6();
        this.processorCount = i.getProcessorCount();
        this.coreCount = i.getCoreCount();
        this.systemMemoryBytes = i.getSystemMemoryBytes();
        this.linuxDistribution = i.getLinuxDistribution();
        this.service = i.getService();
        this.nrEnvironment = i.getNrEnvironment();
        this.team = i.getTeam();
        this.nrLocation = i.getNrLocation();
        this.accountId = i.getAccountId();
        this.sysId = i.getSysId();
        this.os = i.getOs();
        this.osVersion = i.getOsVersion();
        this.cmdbIpAddress = i.getCmdbIpAddress();
        this.cmdbLocation = i.getCmdbLocation();
        this.department = i.getDepartment();
        this.cmdbEnvironment = i.getCmdbEnvironment();
        this.operationalStatus = i.getOperationalStatus();
        this.classification = i.getClassification();
        this.cmdbLastSynced = i.getCmdbLastSynced();
        this.sources = i.getSources();
    }
}
