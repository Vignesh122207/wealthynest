package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.recurringincome.service.RecurringIncomeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecurringIncomeScheduler {

    private final RecurringIncomeService recurringIncomeService;

    /** Called by JobSchedulerService daily (and can be triggered from Admin). */
    public void processRecurringIncome() {
        log.info("Starting recurring income processing...");
        recurringIncomeService.processScheduled();
    }
}
