package com.wealthynest.domain.admin.service;

import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import com.wealthynest.domain.admin.repository.JobScheduleConfigRepository;
import com.wealthynest.infra.external.StockDataService;
import com.wealthynest.infra.scheduler.AutoIncomeScheduler;
import com.wealthynest.infra.scheduler.PriceRefreshScheduler;
import com.wealthynest.infra.scheduler.RecurringExpenseScheduler;
import com.wealthynest.infra.scheduler.RecurringIncomeScheduler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobSchedulerService {

    private final JobScheduleConfigRepository configRepo;
    private final AutoIncomeScheduler         autoIncomeScheduler;
    private final PriceRefreshScheduler       priceRefreshScheduler;
    private final StockDataService            stockDataService;
    private final RecurringExpenseScheduler   recurringExpenseScheduler;
    private final RecurringIncomeScheduler    recurringIncomeScheduler;

    private final ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
    private final Map<String, ScheduledFuture<?>> futures = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        taskScheduler.setPoolSize(4);
        taskScheduler.setThreadNamePrefix("job-scheduler-");
        taskScheduler.initialize();
        configRepo.findAll().forEach(this::schedule);
        log.info("JobSchedulerService initialized {} jobs", futures.size());
    }

    @PreDestroy
    public void shutdown() {
        futures.values().forEach(f -> f.cancel(false));
        taskScheduler.shutdown();
    }

    /** Reschedule a job with a new cron expression and persist to DB. */
    @Transactional
    public JobScheduleConfig updateSchedule(String jobName, String cronExpression) {
        JobScheduleConfig cfg = configRepo.findById(jobName)
            .orElseThrow(() -> new IllegalArgumentException("Unknown job: " + jobName));
        cfg.setCronExpression(cronExpression);
        configRepo.save(cfg);
        schedule(cfg);
        log.info("Job {} rescheduled: {}", jobName, cronExpression);
        return cfg;
    }

    /**
     * Manually trigger a job. Returns immediately — the job runs in the background
     * via the taskScheduler thread pool. Status is updated in job_schedule_config
     * so the frontend can poll for completion.
     */
    public void triggerNow(String jobName) {
        // Validate job name before submitting
        if (!configRepo.existsById(jobName)) {
            throw new IllegalArgumentException("Unknown job: " + jobName);
        }
        log.info("Manual trigger (async): {}", jobName);
        markRunning(jobName);
        taskScheduler.submit(() -> runScheduled(jobName));
    }

    public List<JobScheduleConfig> getAllConfigs() {
        return configRepo.findAll();
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private void schedule(JobScheduleConfig cfg) {
        ScheduledFuture<?> old = futures.remove(cfg.getJobName());
        if (old != null) old.cancel(false);
        if (!cfg.isEnabled()) return;

        TimeZone tz = TimeZone.getTimeZone(ZoneId.of(cfg.getTimezone()));
        ScheduledFuture<?> future = taskScheduler.schedule(
            () -> runScheduled(cfg.getJobName()),
            new CronTrigger(cfg.getCronExpression(), tz)
        );
        futures.put(cfg.getJobName(), future);
    }

    private void runScheduled(String jobName) {
        log.info("Scheduled run: {}", jobName);
        markRunning(jobName);
        try {
            runJob(jobName);
            markSuccess(jobName);
        } catch (Exception e) {
            markFailed(jobName, e.getMessage());
        }
    }

    private void runJob(String jobName) {
        switch (jobName) {
            case "AUTO_INCOME"          -> autoIncomeScheduler.runAllAutoIncome();
            case "NSE_EOD"              -> runNseEod();
            case "GOLD_PRICE"           -> priceRefreshScheduler.refreshGoldPrice();
            case "MF_NAV"               -> priceRefreshScheduler.refreshMFNav();
            case "RECURRING_EXPENSES"   -> recurringExpenseScheduler.processRecurringExpenses();
            case "RECURRING_INCOME"     -> recurringIncomeScheduler.processRecurringIncome();
            default -> throw new IllegalArgumentException("Unknown job: " + jobName);
        }
    }

    private void runNseEod() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        for (int i = 0; i <= 3; i++) {
            LocalDate date = today.minusDays(i);
            if (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY) continue;
            int updated = stockDataService.updateEODPrices(date);
            if (updated > 0) {
                stockDataService.refreshDailyCorporateActions(date);
                break;
            }
        }
    }

    @Transactional
    void markRunning(String jobName) {
        configRepo.findById(jobName).ifPresent(cfg -> {
            cfg.setLastRunAt(Instant.now());
            cfg.setLastRunStatus("RUNNING");
            cfg.setLastRunMessage(null);
            configRepo.save(cfg);
        });
    }

    @Transactional
    void markSuccess(String jobName) {
        configRepo.findById(jobName).ifPresent(cfg -> {
            cfg.setLastRunStatus("SUCCESS");
            configRepo.save(cfg);
        });
    }

    @Transactional
    void markFailed(String jobName, String message) {
        configRepo.findById(jobName).ifPresent(cfg -> {
            cfg.setLastRunStatus("FAILED");
            cfg.setLastRunMessage(message);
            configRepo.save(cfg);
        });
    }
}
