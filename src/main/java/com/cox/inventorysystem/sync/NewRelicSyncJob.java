package com.cox.inventorysystem.sync;

import com.cox.inventorysystem.client.NewRelicApiClient;
import com.cox.inventorysystem.client.NewRelicApiClient.HostData;
import com.cox.inventorysystem.model.NewRelic;
import com.cox.inventorysystem.repository.CredentialRepository;
import com.cox.inventorysystem.repository.NewRelicRepository;
import com.cox.inventorysystem.service.ScheduleService;
import com.cox.inventorysystem.service.SyncStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class NewRelicSyncJob {

    private static final String SERVICE = "newrelic";

    private final ScheduleService scheduleService;
    private final SyncStatusService syncStatusService;
    private final CredentialRepository credentialRepository;
    private final NewRelicApiClient newRelicApiClient;
    private final NewRelicRepository newRelicRepository;

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
                log.warn("New Relic sync already running, skipping scheduled trigger");
                return;
            }
            runSync();
        } catch (Exception e) {
            log.error("New Relic sync poll error: {}", e.getMessage());
        }
    }

    public void runSync() {
        syncStatusService.markRunning(SERVICE);
        log.info("New Relic sync started");
        try {
            var credentials = credentialRepository.findByServiceAndEnabledTrue(SERVICE);
            for (var cred : credentials) {
                try {
                    var hosts = newRelicApiClient.fetchAllHosts(String.valueOf(cred.getId()));
                    for (HostData host : hosts) {
                        if (host != null) try {
                            upsert(host);
                        } catch (Exception e) {
                            log.error("Failed to upsert host {}: {}", host.hostname(), e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    log.error("New Relic sync failed for credential {}: {}", cred.getName(), e.getMessage());
                }
            }
            scheduleService.recordLastRun(SERVICE);
            syncStatusService.markSuccess(SERVICE);
            log.info("New Relic sync completed");
        } catch (Exception e) {
            syncStatusService.markFailed(SERVICE, e.getMessage());
            log.error("New Relic sync failed: {}", e.getMessage());
        }
    }

    private void upsert(HostData host) {
        NewRelic entity = newRelicRepository.findById(host.hostname())
                .orElse(new NewRelic());
        entity.setHostname(host.hostname());
        entity.setFullHostname(host.fullHostname());
        entity.setIpv4Address(host.ipv4Address());
        entity.setIpv6Address(host.ipv6Address());
        entity.setProcessorCount(host.processorCount());
        entity.setCoreCount(host.coreCount());
        entity.setSystemMemoryBytes(host.systemMemoryBytes());
        entity.setLinuxDistribution(host.linuxDistribution());
        entity.setService(host.service());
        entity.setEnvironment(host.environment());
        entity.setTeam(host.team());
        entity.setLocation(host.location());
        entity.setAccountId(host.accountId());
        newRelicRepository.save(entity);
    }
}
