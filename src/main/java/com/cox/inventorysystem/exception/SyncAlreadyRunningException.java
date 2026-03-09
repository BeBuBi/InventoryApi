package com.cox.inventorysystem.exception;

public class SyncAlreadyRunningException extends RuntimeException {
    public SyncAlreadyRunningException(String service) {
        super("Sync is already running for service: " + service);
    }
}
