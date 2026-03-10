package com.cox.inventorysystem.controller;

import com.cox.inventorysystem.dto.InventoryResponse;
import com.cox.inventorysystem.dto.IpDiscrepancyResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final InventoryService inventoryService;

    /**
     * Returns hostnames that exist in vSphere or New Relic but have no CMDB record.
     */
    @GetMapping("/missing-from-cmdb")
    public ResponseEntity<PagedResponse<InventoryResponse>> missingFromCmdb(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String powerState,
            @RequestParam(required = false) String sources,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(inventoryService.listMissingFromCmdb(search, powerState, sources, page, size));
    }

    @GetMapping("/missing-from-cmdb/count")
    public ResponseEntity<Map<String, Long>> missingFromCmdbCount() {
        return ResponseEntity.ok(Map.of("count", inventoryService.countMissingFromCmdb()));
    }

    /**
     * For each host in CMDB that has vSphere/NR IPs, iterates each source IP and
     * reports hosts where at least one source IP is absent from the CMDB IP list.
     */
    @GetMapping("/ip-discrepancy")
    public ResponseEntity<PagedResponse<IpDiscrepancyResponse>> ipDiscrepancy(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return ResponseEntity.ok(inventoryService.listIpDiscrepancies(search, page, size));
    }
}
