package com.cox.inventorysystem.service;

import com.cox.inventorysystem.dto.SyncScheduleRequest;
import com.cox.inventorysystem.dto.SyncScheduleResponse;
import com.cox.inventorysystem.exception.ResourceNotFoundException;
import com.cox.inventorysystem.model.SyncSchedule;
import com.cox.inventorysystem.repository.ScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;

    public List<SyncScheduleResponse> listAll() {
        return scheduleRepository.findAll()
                .stream()
                .map(SyncScheduleResponse::new)
                .toList();
    }

    public SyncScheduleResponse getByService(String service) {
        return new SyncScheduleResponse(findOrThrow(service));
    }

    @Transactional
    public SyncScheduleResponse update(String service, SyncScheduleRequest req) {
        SyncSchedule schedule = findOrThrow(service);
        schedule.setCronExpr(req.getCronExpr());
        schedule.setEnabled(req.isEnabled());
        schedule.setDescription(req.getDescription());
        return new SyncScheduleResponse(scheduleRepository.save(schedule));
    }

    @Transactional
    public SyncScheduleResponse setEnabled(String service, boolean enabled) {
        SyncSchedule schedule = findOrThrow(service);
        schedule.setEnabled(enabled);
        return new SyncScheduleResponse(scheduleRepository.save(schedule));
    }

    public SyncSchedule findEntityByService(String service) {
        return findOrThrow(service);
    }

    @Transactional
    public void recordLastRun(String service) {
        SyncSchedule schedule = findOrThrow(service);
        schedule.setLastRunAt(java.time.LocalDateTime.now().toString());
        scheduleRepository.save(schedule);
    }

    private SyncSchedule findOrThrow(String service) {
        return scheduleRepository.findByService(service)
                .orElseThrow(() -> new ResourceNotFoundException("Schedule not found for service: " + service));
    }
}
