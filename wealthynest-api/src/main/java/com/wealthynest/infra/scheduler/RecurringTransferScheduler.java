package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.recurringtransfer.service.RecurringTransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecurringTransferScheduler {

    private final RecurringTransferService recurringTransferService;

    /** Called by JobSchedulerService daily (and can be triggered from Admin). */
    public void processRecurringTransfers() {
        log.info("Starting recurring transfer processing...");
        recurringTransferService.processScheduled();
    }
}
