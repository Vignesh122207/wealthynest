package com.wealthynest.domain.admin.service;

import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import com.wealthynest.domain.admin.repository.JobScheduleConfigRepository;
import com.wealthynest.infra.external.StockDataService;
import com.wealthynest.infra.scheduler.AutoIncomeScheduler;
import com.wealthynest.infra.scheduler.DebtReminderScheduler;
import com.wealthynest.infra.scheduler.EmiReminderScheduler;
import com.wealthynest.infra.scheduler.LoanEmiScheduler;
import com.wealthynest.infra.scheduler.LowBalanceScheduler;
import com.wealthynest.infra.scheduler.NetWorthSnapshotScheduler;
import com.wealthynest.infra.scheduler.PriceRefreshScheduler;
import com.wealthynest.infra.scheduler.RecurringExpenseScheduler;
import com.wealthynest.infra.scheduler.RecurringGoalContributionScheduler;
import com.wealthynest.infra.scheduler.RecurringIncomeScheduler;
import com.wealthynest.infra.scheduler.RecurringTransferScheduler;
import com.wealthynest.infra.scheduler.SpendAnomalyScheduler;
import com.wealthynest.infra.scheduler.StockDataScheduler;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
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
    private final NetWorthSnapshotScheduler   netWorthSnapshotScheduler;
    private final StockDataScheduler          stockDataScheduler;
    private final LoanEmiScheduler            loanEmiScheduler;
    private final LowBalanceScheduler         lowBalanceScheduler;
    private final SpendAnomalyScheduler       spendAnomalyScheduler;
    private final DebtReminderScheduler       debtReminderScheduler;
    private final EmiReminderScheduler        emiReminderScheduler;
    private final RecurringTransferScheduler  recurringTransferScheduler;
    private final RecurringGoalContributionScheduler recurringGoalContributionScheduler;
    private final DataSource                  dataSource;

    /** Namespaces this service's advisory-lock keys away from any future unrelated use of the
     * same mechanism — the actual job identity lives in the low 32 bits (see lockKeyFor). */
    private static final long ADVISORY_LOCK_NAMESPACE = 0x4A4F4200_00000000L;

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

    /**
     * Runs a job under a Postgres session-level advisory lock keyed by job name, so that if this
     * service is ever scaled to more than one instance, only one instance actually executes a
     * given job's body on a given tick — the others see the lock held and skip immediately instead
     * of both crediting the same recurring income or debiting the same EMI. The lock is taken and
     * released on a connection borrowed directly from the pool (bypassing Spring's transactional
     * connection) so its lifecycle can't leak across pooled-connection reuse.
     */
    private void runScheduled(String jobName) {
        log.info("Scheduled run: {}", jobName);
        long lockKey = lockKeyFor(jobName);
        try (Connection conn = dataSource.getConnection()) {
            if (!tryLock(conn, lockKey)) {
                log.info("Skipping {} — already running on another instance", jobName);
                return;
            }
            try {
                markRunning(jobName);
                runJob(jobName);
                markSuccess(jobName);
            } catch (Exception e) {
                markFailed(jobName, e.getMessage());
            } finally {
                unlock(conn, lockKey);
            }
        } catch (SQLException e) {
            log.error("Advisory lock unavailable for job {}: {}", jobName, e.getMessage(), e);
        }
    }

    private long lockKeyFor(String jobName) {
        return ADVISORY_LOCK_NAMESPACE | (jobName.hashCode() & 0xFFFFFFFFL);
    }

    private boolean tryLock(Connection conn, long lockKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
            ps.setLong(1, lockKey);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() && rs.getBoolean(1);
            }
        }
    }

    private void unlock(Connection conn, long lockKey) {
        try (PreparedStatement ps = conn.prepareStatement("SELECT pg_advisory_unlock(?)")) {
            ps.setLong(1, lockKey);
            ps.execute();
        } catch (SQLException e) {
            log.warn("Failed to release advisory lock {}: {}", lockKey, e.getMessage());
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
            case "NET_WORTH_SNAPSHOT"   -> netWorthSnapshotScheduler.takeMonthlySnapshots();
            case "STOCK_WEEKLY_REFRESH" -> stockDataScheduler.weeklyMasterRefresh();
            case "LOAN_EMI"             -> loanEmiScheduler.processDueEmis();
            case "LOW_BALANCE_CHECK"    -> lowBalanceScheduler.checkAllAccounts();
            case "SPEND_ANOMALY_CHECK"  -> spendAnomalyScheduler.checkRecentExpenses();
            case "DEBT_DUE_REMINDER"    -> debtReminderScheduler.checkUpcomingDueDates();
            case "LOAN_EMI_REMINDER"    -> emiReminderScheduler.checkUpcomingEmis();
            case "RECURRING_TRANSFER"   -> recurringTransferScheduler.processRecurringTransfers();
            case "RECURRING_GOAL_CONTRIBUTION" -> recurringGoalContributionScheduler.processRecurringGoalContributions();
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
