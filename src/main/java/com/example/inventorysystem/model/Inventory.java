package com.example.inventorysystem.model;

import jakarta.persistence.*;
import lombok.Getter;
import org.hibernate.annotations.Immutable;

@Immutable
@Entity
@Table(name = "inventory")
@Getter
public class Inventory {

    @Id
    @Column(name = "hostname")
    private String hostname;

    // vSphere fields
    @Column(name = "vsphere_ipv4")          private String vsphereIpv4;
    @Column(name = "vsphere_ipv6")          private String vsphereIpv6;
    @Column(name = "vm_name")               private String vmName;
    @Column(name = "cpu_count")             private Integer cpuCount;
    @Column(name = "cpu_cores")             private Integer cpuCores;
    @Column(name = "memory_mb")             private Integer memoryMb;
    @Column(name = "memory_gb")             private Integer memoryGb;
    @Column(name = "power_state")           private String powerState;
    @Column(name = "guest_os")              private String guestOs;
    @Column(name = "tools_status")          private String toolsStatus;
    @Column(name = "vsphere_last_synced")   private String vsphereLastSynced;

    // New Relic fields
    @Column(name = "full_hostname")         private String fullHostname;
    @Column(name = "nr_ipv4")               private String nrIpv4;
    @Column(name = "nr_ipv6")               private String nrIpv6;
    @Column(name = "processor_count")       private Integer processorCount;
    @Column(name = "core_count")            private Integer coreCount;
    @Column(name = "system_memory_bytes")   private Long systemMemoryBytes;
    @Column(name = "linux_distribution")    private String linuxDistribution;
    @Column(name = "service")               private String service;
    @Column(name = "nr_environment")        private String nrEnvironment;
    @Column(name = "team")                  private String team;
    @Column(name = "nr_location")           private String nrLocation;
    @Column(name = "account_id")            private String accountId;

    // CMDB fields
    @Column(name = "sys_id")                private String sysId;
    @Column(name = "os")                    private String os;
    @Column(name = "os_version")            private String osVersion;
    @Column(name = "cmdb_ip_address")       private String cmdbIpAddress;
    @Column(name = "cmdb_location")         private String cmdbLocation;
    @Column(name = "department")            private String department;
    @Column(name = "cmdb_environment")      private String cmdbEnvironment;
    @Column(name = "operational_status")    private String operationalStatus;
    @Column(name = "classification")        private String classification;
    @Column(name = "cmdb_last_synced")      private String cmdbLastSynced;

    // Meta
    @Column(name = "sources")              private String sources;
}
