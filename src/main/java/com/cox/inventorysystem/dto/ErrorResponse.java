package com.cox.inventorysystem.dto;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.time.Instant;

@Getter
@RequiredArgsConstructor
public class ErrorResponse {

    private final int status;
    private final String error;
    private final String message;
    private final Instant timestamp;

    public static ErrorResponse of(int status, String error, String message) {
        return new ErrorResponse(status, error, message, Instant.now());
    }
}
