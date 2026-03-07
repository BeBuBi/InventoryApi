package com.example.inventorysystem.controller;

import com.example.inventorysystem.dto.NewRelicResponse;
import com.example.inventorysystem.dto.PagedResponse;
import com.example.inventorysystem.dto.SyncStatusResponse;
import com.example.inventorysystem.exception.SyncAlreadyRunningException;
import com.example.inventorysystem.service.NewRelicService;
import com.example.inventorysystem.service.SyncStatusService;
import com.example.inventorysystem.sync.NewRelicSyncJob;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/newrelic")
@RequiredArgsConstructor
public class NewRelicController {

    private final NewRelicService newRelicService;
    private final SyncStatusService syncStatusService;
    private final NewRelicSyncJob newRelicSyncJob;

    @GetMapping
    public PagedResponse<NewRelicResponse> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String service,
            @RequestParam(required = false) String environment,
            @RequestParam(required = false) String accountId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return newRelicService.list(search, service, environment, accountId, page, size);
    }

    @GetMapping("/environments")
    public java.util.List<String> listEnvironments() {
        return newRelicService.listEnvironments();
    }

    @GetMapping("/accounts")
    public java.util.List<String> listAccountIds() {
        return newRelicService.listAccountIds();
    }

    @GetMapping("/{hostname}")
    public NewRelicResponse getByHostname(@PathVariable String hostname) {
        return newRelicService.getByHostname(hostname);
    }

    @PostMapping("/sync")
    public ResponseEntity<SyncStatusResponse> triggerSync() {
        if (syncStatusService.isRunning("newrelic")) {
            throw new SyncAlreadyRunningException("newrelic");
        }
        syncStatusService.markRunning("newrelic");
        new Thread(newRelicSyncJob::runSync).start();
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(syncStatusService.getStatus("newrelic"));
    }

    @GetMapping("/sync/status")
    public SyncStatusResponse getSyncStatus() {
        return syncStatusService.getStatus("newrelic");
    }
}
