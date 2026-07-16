package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.recurringgoalcontribution.service.RecurringGoalContributionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecurringGoalContributionScheduler {

    private final RecurringGoalContributionService recurringGoalContributionService;

    /** Called by JobSchedulerService daily (and can be triggered from Admin). */
    public void processRecurringGoalContributions() {
        log.info("Starting recurring goal contribution processing...");
        recurringGoalContributionService.processScheduled();
    }
}
