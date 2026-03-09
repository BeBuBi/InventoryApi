package com.cox.inventorysystem.controller;

import com.cox.inventorysystem.dto.NewRelicResponse;
import com.cox.inventorysystem.dto.PagedResponse;
import com.cox.inventorysystem.dto.SyncStatusResponse;
import com.cox.inventorysystem.exception.SyncAlreadyRunningException;
import com.cox.inventorysystem.service.NewRelicService;
import com.cox.inventorysystem.service.SyncStatusService;
import com.cox.inventorysystem.sync.NewRelicSyncJob;
import java.util.List;
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
            @RequestParam(required = false) List<String> accountIds,
            @RequestParam(required = false) List<String> linuxDistros,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return newRelicService.list(search, service, environment, accountIds, linuxDistros, page, size);
    }

    @GetMapping("/environments")
    public List<String> listEnvironments() {
        return newRelicService.listEnvironments();
    }

    @GetMapping("/accounts")
    public List<String> listAccountIds() {
        return newRelicService.listAccountIds();
    }

    @GetMapping("/linux-distros")
    public List<String> listLinuxDistros() {
        return newRelicService.listLinuxDistros();
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
