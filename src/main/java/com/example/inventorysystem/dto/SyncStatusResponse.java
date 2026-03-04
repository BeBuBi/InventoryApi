package com.example.inventorysystem.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.time.Instant;

@Getter
@RequiredArgsConstructor
public class SyncStatusResponse {

    private final String service;
    private final String status;
    private final Instant lastRunAt;
    private final String lastError;
}
