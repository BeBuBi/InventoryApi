package com.example.inventorysystem.controller;

import com.example.inventorysystem.dto.CmdbResponse;
import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.dto.SyncStatusResponse;
import com.example.inventorysystem.exception.SyncAlreadyRunningException;
import com.example.inventorysystem.service.CmdbService;
import com.example.inventorysystem.service.SyncStatusService;
import com.example.inventorysystem.sync.CmdbSyncJob;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cmdb")
@RequiredArgsConstructor
public class CmdbController {

    private final CmdbService cmdbService;
    private final SyncStatusService syncStatusService;
    private final CmdbSyncJob cmdbSyncJob;

    @GetMapping
    public PagedResponse<CmdbResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> opStatuses,
            @RequestParam(required = false) List<String> osVersions,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return cmdbService.list(search, opStatuses, osVersions, page, size);
    }

    @GetMapping("/operational-statuses")
    public List<String> listOperationalStatuses() {
        return cmdbService.listOperationalStatuses();
    }

    @GetMapping("/os-versions")
    public List<String> listOsVersions() {
        return cmdbService.listOsVersions();
    }

    @GetMapping("/{hostname}")
    public CmdbResponse getByHostname(@PathVariable String hostname) {
        return cmdbService.getByHostname(hostname);
    }

    @PostMapping("/sync")
    public ResponseEntity<SyncStatusResponse> triggerSync() {
        if (syncStatusService.isRunning("cmdb")) {
            throw new SyncAlreadyRunningException("cmdb");
        }
        syncStatusService.markRunning("cmdb");
        new Thread(cmdbSyncJob::runSync).start();
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(syncStatusService.getStatus("cmdb"));
    }

    @GetMapping("/sync/status")
    public SyncStatusResponse getSyncStatus() {
        return syncStatusService.getStatus("cmdb");
    }
}
