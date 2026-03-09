package com.cox.inventorysystem.controller;

import com.cox.inventorysystem.dto.SyncScheduleRequest;
import com.cox.inventorysystem.dto.SyncScheduleResponse;
import com.cox.inventorysystem.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/settings/schedule")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping
    public List<SyncScheduleResponse> listAll() {
        return scheduleService.listAll();
    }

    @GetMapping("/{service}")
    public SyncScheduleResponse getByService(@PathVariable String service) {
        return scheduleService.getByService(service);
    }

    @PutMapping("/{service}")
    public SyncScheduleResponse update(@PathVariable String service,
                                       @Valid @RequestBody SyncScheduleRequest req) {
        return scheduleService.update(service, req);
    }

    @PatchMapping("/{service}/enable")
    public SyncScheduleResponse enable(@PathVariable String service) {
        return scheduleService.setEnabled(service, true);
    }

    @PatchMapping("/{service}/disable")
    public SyncScheduleResponse disable(@PathVariable String service) {
        return scheduleService.setEnabled(service, false);
    }
}
