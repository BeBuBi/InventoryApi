package com.example.inventorysystem.sync;

import com.example.inventorysystem.client.CmdbApiClient;
import com.example.inventorysystem.client.CmdbApiClient.AssetData;
import com.example.inventorysystem.model.Cmdb;
import com.example.inventorysystem.repository.CmdbRepository;
import com.example.inventorysystem.repository.CredentialRepository;
import com.example.inventorysystem.service.ScheduleService;
import com.example.inventorysystem.service.SyncStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class CmdbSyncJob {

    private static final String SERVICE = "cmdb";

    private final ScheduleService scheduleService;
    private final SyncStatusService syncStatusService;
    private final CredentialRepository credentialRepository;
    private final CmdbApiClient cmdbApiClient;
    private final CmdbRepository cmdbRepository;

    @Scheduled(fixedDelay = 60_000)
    public void poll() {
        try {
            var schedule = scheduleService.findEntityByService(SERVICE);
            if (!schedule.isEnabled()) return;

            CronExpression cron = CronExpression.parse(schedule.getCronExpr());
            ZonedDateTime now = ZonedDateTime.now();
            ZonedDateTime prevMinute = now.minusMinutes(1).withSecond(0).withNano(0);
            ZonedDateTime next = cron.next(prevMinute);
            if (next == null || next.isAfter(now)) return;

            if (syncStatusService.isRunning(SERVICE)) {
                log.warn("CMDB sync already running, skipping scheduled trigger");
                return;
            }
            runSync();
        } catch (Exception e) {
            log.error("CMDB sync poll error: {}", e.getMessage());
        }
    }

    public void runSync() {
        syncStatusService.markRunning(SERVICE);
        log.info("CMDB sync started");
        try {
            var credentials = credentialRepository.findByServiceAndEnabledTrue(SERVICE);
            for (var cred : credentials) {
                try {
                    var assets = cmdbApiClient.fetchAllAssets(String.valueOf(cred.getId()));
                    for (AssetData asset : assets) {
                        try {
                            upsert(asset);
                        } catch (Exception e) {
                            log.error("Failed to upsert CMDB asset {}: {}", asset.hostname(), e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    log.error("CMDB sync failed for credential {}: {}", cred.getName(), e.getMessage());
                }
            }
            scheduleService.recordLastRun(SERVICE);
            syncStatusService.markSuccess(SERVICE);
            log.info("CMDB sync completed");
        } catch (Exception e) {
            syncStatusService.markFailed(SERVICE, e.getMessage());
            log.error("CMDB sync failed: {}", e.getMessage());
        }
    }

    private void upsert(AssetData asset) {
        Cmdb entity = cmdbRepository.findById(asset.hostname()).orElse(new Cmdb());
        entity.setHostname(asset.hostname());
        entity.setSysId(asset.sysId());
        entity.setOs(asset.os());
        entity.setOsVersion(asset.osVersion());
        entity.setIpAddress(asset.ipAddress());
        entity.setLocation(asset.location());
        entity.setDepartment(asset.department());
        entity.setEnvironment(asset.environment());
        entity.setOperationalStatus(asset.operationalStatus());
        entity.setClassification(asset.classification());
        entity.setLastSyncedAt(LocalDateTime.now().toString());
        cmdbRepository.save(entity);
    }
}
