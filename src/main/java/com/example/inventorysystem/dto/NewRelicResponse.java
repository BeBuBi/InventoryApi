package com.example.inventorysystem.dto;

import com.example.inventorysystem.model.NewRelic;
import lombok.Getter;



@Getter
public class NewRelicResponse {

    private final String hostname;
    private final String fullHostname;
    private final String ipv4Address;
    private final String ipv6Address;
    private final Integer processorCount;
    private final Integer coreCount;
    private final Long systemMemoryBytes;
    private final String linuxDistribution;
    private final String service;
    private final String environment;
    private final String team;
    private final String location;
    private final String accountId;
    private final String createdAt;
    private final String updatedAt;

    public NewRelicResponse(NewRelic n) {
        this.hostname = n.getHostname();
        this.fullHostname = n.getFullHostname();
        this.ipv4Address = n.getIpv4Address();
        this.ipv6Address = n.getIpv6Address();
        this.processorCount = n.getProcessorCount();
        this.coreCount = n.getCoreCount();
        this.systemMemoryBytes = n.getSystemMemoryBytes();
        this.linuxDistribution = n.getLinuxDistribution();
        this.service = n.getService();
        this.environment = n.getEnvironment();
        this.team = n.getTeam();
        this.location = n.getLocation();
        this.accountId = n.getAccountId();
        this.createdAt = n.getCreatedAt();
        this.updatedAt = n.getUpdatedAt();
    }
}
