package com.cox.inventorysystem.controller;

import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.dto.SyncStatusResponse;
import com.cox.inventorysystem.dto.VsphereResponse;
import com.cox.inventorysystem.exception.SyncAlreadyRunningException;
import com.cox.inventorysystem.service.SyncStatusService;
import com.cox.inventorysystem.service.VsphereService;
import com.cox.inventorysystem.sync.VsphereSyncJob;
import java.util.List;
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
            @RequestParam(required = false) List<String> powerStates,
            @RequestParam(required = false) List<String> sourceUrls,
            @RequestParam(required = false) List<String> guestOsTypes,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return vsphereService.list(search, powerStates, sourceUrls, guestOsTypes, page, size);
    }

    @GetMapping("/vcenter-urls")
    public List<String> listSourceUrls() {
        return vsphereService.listSourceUrls();
    }

    @GetMapping("/guest-os-types")
    public List<String> listGuestOsTypes() {
        return vsphereService.listGuestOsTypes();
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
