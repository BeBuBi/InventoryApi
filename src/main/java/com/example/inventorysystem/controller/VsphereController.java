package com.example.inventorysystem.controller;

import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.dto.SyncStatusResponse;
import com.example.inventorysystem.dto.VsphereResponse;
import com.example.inventorysystem.exception.SyncAlreadyRunningException;
import com.example.inventorysystem.service.SyncStatusService;
import com.example.inventorysystem.service.VsphereService;
import com.example.inventorysystem.sync.VsphereSyncJob;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/vsphere")
@RequiredArgsConstructor
public class VsphereController {

    private final VsphereService vsphereService;
    private final SyncStatusService syncStatusService;
    private final VsphereSyncJob vsphereSyncJob;

    @GetMapping
    public PagedResponse<VsphereResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String powerState,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return vsphereService.list(search, powerState, page, size);
    }

    @GetMapping("/{hostname}")
    public VsphereResponse getByHostname(@PathVariable String hostname) {
        return vsphereService.getByHostname(hostname);
    }

    @PostMapping("/sync")
    public ResponseEntity<SyncStatusResponse> triggerSync() {
        if (syncStatusService.isRunning("vsphere")) {
            throw new SyncAlreadyRunningException("vsphere");
        }
        syncStatusService.markRunning("vsphere");
        new Thread(vsphereSyncJob::runSync).start();
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(syncStatusService.getStatus("vsphere"));
    }

    @GetMapping("/sync/status")
    public SyncStatusResponse getSyncStatus() {
        return syncStatusService.getStatus("vsphere");
    }
}
