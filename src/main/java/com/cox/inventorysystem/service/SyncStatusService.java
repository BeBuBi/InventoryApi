package com.cox.inventorysystem.service;

import com.cox.inventorysystem.dto.SyncStatusResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SyncStatusService {

    public enum State { IDLE, RUNNING, SUCCESS, FAILED }

    private record SyncState(State state, Instant lastRunAt, String lastError) {}

    private final Map<String, SyncState> statusMap = new ConcurrentHashMap<>();

    public boolean isRunning(String service) {
        SyncState s = statusMap.get(service);
        return s != null && s.state() == State.RUNNING;
    }

    public void markRunning(String service) {
        statusMap.put(service, new SyncState(State.RUNNING, Instant.now(), null));
    }

    public void markSuccess(String service) {
        statusMap.put(service, new SyncState(State.SUCCESS, Instant.now(), null));
    }

    public void markFailed(String service, String error) {
        statusMap.put(service, new SyncState(State.FAILED, Instant.now(), error));
    }

    public SyncStatusResponse getStatus(String service) {
        SyncState s = statusMap.getOrDefault(service, new SyncState(State.IDLE, null, null));
        return new SyncStatusResponse(service, s.state().name().toLowerCase(), s.lastRunAt(), s.lastError());
    }
}
