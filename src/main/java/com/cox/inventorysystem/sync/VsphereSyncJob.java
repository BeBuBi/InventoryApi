package com.cox.inventorysystem.sync;

import com.cox.inventorysystem.client.VsphereApiClient;
import com.cox.inventorysystem.client.VsphereApiClient.VmData;
import com.cox.inventorysystem.model.Vsphere;
import com.cox.inventorysystem.repository.CredentialRepository;
import com.cox.inventorysystem.repository.VsphereRepository;
import com.cox.inventorysystem.service.ScheduleService;
import com.cox.inventorysystem.service.SyncStatusService;
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
public class VsphereSyncJob {

    private static final String SERVICE = "vsphere";

    private final ScheduleService scheduleService;
    private final SyncStatusService syncStatusService;
    private final CredentialRepository credentialRepository;
    private final VsphereApiClient vsphereApiClient;
    private final VsphereRepository vsphereRepository;

    @Scheduled(fixedDelay = 60_000)
    public void poll() {
        try {
            var schedule = scheduleService.findEntityByService(SERVICE);
            if (!schedule.isEnabled()) return;

            CronExpression cron = CronExpression.parse(schedule.getCronExpr());
            ZonedDateTime now = ZonedDateTime.now();
            // Check if the cron matches within the current minute
            ZonedDateTime prevMinute = now.minusMinutes(1).withSecond(0).withNano(0);
            ZonedDateTime next = cron.next(prevMinute);
            if (next == null || next.isAfter(now)) return;

            if (syncStatusService.isRunning(SERVICE)) {
                log.warn("vSphere sync already running, skipping scheduled trigger");
                return;
            }
            runSync();
        } catch (Exception e) {
            log.error("vSphere sync poll error: {}", e.getMessage());
        }
    }

    public void runSync() {
        syncStatusService.markRunning(SERVICE);
        log.info("vSphere sync started");
        try {
            var credentials = credentialRepository.findByServiceAndEnabledTrue(SERVICE);
            for (var cred : credentials) {
                try {
                    var vms = vsphereApiClient.fetchAllVms(String.valueOf(cred.getId()));
                    for (VmData vm : vms) {
                        try {
                            upsert(vm);
                        } catch (Exception e) {
                            log.error("Failed to upsert VM {}: {}", vm.hostname(), e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    log.error("vSphere sync failed for credential {}: {}", cred.getName(), e.getMessage());
                }
            }
            scheduleService.recordLastRun(SERVICE);
            syncStatusService.markSuccess(SERVICE);
            log.info("vSphere sync completed");
        } catch (Exception e) {
            syncStatusService.markFailed(SERVICE, e.getMessage());
            log.error("vSphere sync failed: {}", e.getMessage());
        }
    }

    private void upsert(VmData vm) {
        Vsphere entity = vsphereRepository.findById(vm.hostname()).orElse(new Vsphere());
        entity.setHostname(vm.hostname());
        entity.setVmName(vm.vmName());
        entity.setCpuCount(vm.cpuCount());
        entity.setCpuCores(vm.cpuCores());
        entity.setMemoryMb(vm.memoryMb());
        entity.setMemoryGb(vm.memoryGb());
        entity.setPowerState(vm.powerState());
        entity.setGuestOs(vm.guestOs());
        entity.setToolsStatus(vm.toolsStatus());
        entity.setIpv4Address(vm.ipv4Address());
        entity.setIpv6Address(vm.ipv6Address());
        entity.setSourceUrl(vm.sourceUrl());
        entity.setLastSyncedAt(LocalDateTime.now().toString());
        vsphereRepository.save(entity);
    }
}
