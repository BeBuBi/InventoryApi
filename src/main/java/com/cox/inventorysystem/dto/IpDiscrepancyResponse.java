package com.cox.inventorysystem.dto;

import com.cox.inventorysystem.model.Inventory;
import lombok.Getter;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

@Getter
public class IpDiscrepancyResponse {

    private final String hostname;
    private final List<String> vsphereIps;  // parsed IPv4s from vSphere
    private final List<String> nrIps;       // parsed IPv4s from New Relic
    private final List<String> cmdbIps;     // parsed IPv4s from CMDB
    private final List<String> notInCmdb;   // source IPs not found in CMDB
    private final String sources;
    private final String discrepancyType;
    private final String powerState;
    private final String guestOs;

    public IpDiscrepancyResponse(Inventory i) {
        this.hostname   = i.getHostname();
        this.vsphereIps = sortedIpv4(i.getVsphereIpv4());
        this.nrIps      = sortedIpv4(i.getNrIpv4());
        this.cmdbIps    = sortedIpv4(i.getCmdbIpAddress());
        this.sources    = i.getSources();
        this.powerState = i.getPowerState();
        this.guestOs    = i.getGuestOs();

        // Combined source list: vsphere IPs + NR IPs (deduplicated)
        List<String> sourceIps = Stream.concat(vsphereIps.stream(), nrIps.stream())
                .distinct()
                .toList();

        // For each IP in sourceIps, check if it is in the CMDB set
        Set<String> cmdbSet = new HashSet<>(cmdbIps);
        this.notInCmdb = sourceIps.stream()
                .filter(ip -> !cmdbSet.contains(ip))
                .toList();

        this.discrepancyType = cmdbIps.isEmpty() ? "CMDB has no IP" : "IP mismatch";
    }

    /**
     * Returns true when at least one vSphere/NR IPv4 is absent from the CMDB IPv4 list.
     * Hosts where CMDB stores only IPv6 are skipped (not reportable by IPv4 comparison).
     */
    public static boolean isDiscrepancy(Inventory i) {
        List<String> sourceIps = Stream
                .concat(parseIpv4(i.getVsphereIpv4()).stream(), parseIpv4(i.getNrIpv4()).stream())
                .distinct()
                .toList();

        if (sourceIps.isEmpty()) return false;

        // CMDB has a value but it contains no IPv4 (e.g. pure IPv6) — skip
        String rawCmdb = i.getCmdbIpAddress();
        if (rawCmdb != null && !rawCmdb.isBlank()) {
            List<String> cmdbIps = parseIpv4(rawCmdb);
            if (cmdbIps.isEmpty()) return false;

            Set<String> cmdbSet = new HashSet<>(cmdbIps);
            // iterate each source IP — report if any is not in CMDB
            return sourceIps.stream().anyMatch(ip -> !cmdbSet.contains(ip));
        }

        // CMDB has no IP at all → every source IP is missing
        return true;
    }

    /** Split a comma-separated string, trim whitespace, keep only IPv4 (no colon). */
    public static List<String> parseIpv4(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty() && !s.contains(":"))
                .distinct()
                .toList();
    }

    /** Like parseIpv4 but sorted numerically ascending. */
    private static List<String> sortedIpv4(String value) {
        return parseIpv4(value).stream()
                .sorted(java.util.Comparator.comparingLong(IpDiscrepancyResponse::ipToLong))
                .toList();
    }

    /** Convert dotted-decimal IPv4 to long for numeric sort. */
    public static long ipToLong(String ip) {
        try {
            String[] p = ip.split("\\.");
            return (Long.parseLong(p[0]) << 24)
                 | (Long.parseLong(p[1]) << 16)
                 | (Long.parseLong(p[2]) <<  8)
                 |  Long.parseLong(p[3]);
        } catch (Exception e) {
            return Long.MAX_VALUE;
        }
    }
}
