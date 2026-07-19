package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.investment.repository.MfMasterRepository;
import com.wealthynest.infra.external.ExternalPriceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Keeps mf_master (the local mirror mutual fund search actually queries) in sync with mfapi.in's
 * full scheme list — same shape as StockDataScheduler's NSE/BSE master refresh: seed on first
 * boot if empty, then a weekly full refresh via JobSchedulerService (MF_MASTER_SYNC job,
 * admin-configurable/triggerable). Scheme names change rarely, so weekly is plenty.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MfMasterSyncScheduler {

    private final ExternalPriceService externalPriceService;
    private final MfMasterRepository   mfMasterRepository;

    @Async
    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        if (mfMasterRepository.count() == 0) {
            log.info("mf_master empty — seeding from mfapi.in …");
            externalPriceService.syncMfMaster();
        }
    }

    /** Entry point called by JobSchedulerService (MF_MASTER_SYNC job). */
    public void weeklySync() {
        log.info("Weekly MF master sync starting …");
        int synced = externalPriceService.syncMfMaster();
        log.info("Weekly MF master sync done: {} schemes", synced);
    }
}
