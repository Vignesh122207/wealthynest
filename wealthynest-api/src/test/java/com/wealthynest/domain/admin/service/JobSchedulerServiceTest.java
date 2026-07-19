package com.wealthynest.domain.admin.service;

import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.admin.entity.JobScheduleConfig;
import com.wealthynest.domain.admin.repository.JobScheduleConfigRepository;
import com.wealthynest.infra.external.StockDataService;
import com.wealthynest.infra.scheduler.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JobSchedulerServiceTest {

    @Mock private JobScheduleConfigRepository        configRepo;
    @Mock private AutoIncomeScheduler                 autoIncomeScheduler;
    @Mock private PriceRefreshScheduler               priceRefreshScheduler;
    @Mock private StockDataService                    stockDataService;
    @Mock private RecurringExpenseScheduler           recurringExpenseScheduler;
    @Mock private RecurringIncomeScheduler            recurringIncomeScheduler;
    @Mock private NetWorthSnapshotScheduler           netWorthSnapshotScheduler;
    @Mock private StockDataScheduler                  stockDataScheduler;
    @Mock private LoanEmiScheduler                    loanEmiScheduler;
    @Mock private LowBalanceScheduler                 lowBalanceScheduler;
    @Mock private SpendAnomalyScheduler               spendAnomalyScheduler;
    @Mock private DebtReminderScheduler               debtReminderScheduler;
    @Mock private EmiReminderScheduler                emiReminderScheduler;
    @Mock private RecurringTransferScheduler          recurringTransferScheduler;
    @Mock private RecurringGoalContributionScheduler  recurringGoalContributionScheduler;
    @Mock private MfMasterSyncScheduler                mfMasterSyncScheduler;
    @Mock private DataSource                          dataSource;

    private JobSchedulerService service;

    @BeforeEach
    void setUp() {
        service = new JobSchedulerService(configRepo, autoIncomeScheduler, priceRefreshScheduler,
                stockDataService, recurringExpenseScheduler, recurringIncomeScheduler,
                netWorthSnapshotScheduler, stockDataScheduler, loanEmiScheduler, lowBalanceScheduler,
                spendAnomalyScheduler, debtReminderScheduler, emiReminderScheduler,
                recurringTransferScheduler, recurringGoalContributionScheduler, mfMasterSyncScheduler,
                dataSource);
    }

    @AfterEach
    void tearDown() {
        // init() starts a real ThreadPoolTaskScheduler — always release it, even for tests that
        // never called init() (shutdown() on an uninitialized scheduler is a harmless no-op).
        service.shutdown();
    }

    private JobScheduleConfig config(String jobName, boolean enabled) {
        return JobScheduleConfig.builder()
                .jobName(jobName).displayName(jobName).cronExpression("0 0 * * * *")
                .timezone("Asia/Kolkata").enabled(enabled).build();
    }

    // ─── init / shutdown ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("init")
    class InitTests {

        @Test
        @DisplayName("schedules enabled jobs and skips disabled ones")
        void schedulesOnlyEnabledJobs() {
            when(configRepo.findAll()).thenReturn(List.of(config("AUTO_INCOME", true), config("NSE_EOD", false)));

            service.init();

            @SuppressWarnings("unchecked")
            Map<String, ?> futures = (Map<String, ?>) ReflectionTestUtils.getField(service, "futures");
            assertThat(futures).containsKey("AUTO_INCOME");
            assertThat(futures).doesNotContainKey("NSE_EOD");
        }
    }

    // ─── updateSchedule ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateSchedule")
    class UpdateScheduleTests {

        @Test
        @DisplayName("throws for an unknown job name")
        void throwsForUnknownJob() {
            when(configRepo.findById("BOGUS")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateSchedule("BOGUS", "0 0 * * * *"))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("persists the new cron expression and leaves a disabled job unscheduled")
        void updatesDisabledJobWithoutScheduling() {
            JobScheduleConfig cfg = config("AUTO_INCOME", false);
            when(configRepo.findById("AUTO_INCOME")).thenReturn(Optional.of(cfg));

            JobScheduleConfig result = service.updateSchedule("AUTO_INCOME", "0 30 2 * * *");

            assertThat(result.getCronExpression()).isEqualTo("0 30 2 * * *");
            verify(configRepo).save(cfg);
        }

        @Test
        @DisplayName("reschedules an enabled job under a real (initialized) task scheduler")
        void reschedulesEnabledJob() {
            when(configRepo.findAll()).thenReturn(List.of(config("AUTO_INCOME", true)));
            service.init();
            JobScheduleConfig cfg = config("AUTO_INCOME", true);
            when(configRepo.findById("AUTO_INCOME")).thenReturn(Optional.of(cfg));

            service.updateSchedule("AUTO_INCOME", "0 15 3 * * *");

            @SuppressWarnings("unchecked")
            Map<String, ?> futures = (Map<String, ?>) ReflectionTestUtils.getField(service, "futures");
            assertThat(futures).containsKey("AUTO_INCOME");
        }
    }

    // ─── triggerNow ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("triggerNow")
    class TriggerNowTests {

        @Test
        @DisplayName("throws for an unknown job name without touching the task scheduler")
        void throwsForUnknownJob() {
            when(configRepo.existsById("BOGUS")).thenReturn(false);

            assertThatThrownBy(() -> service.triggerNow("BOGUS"))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("marks the job running synchronously and executes it asynchronously")
        void marksRunningAndExecutesAsync() throws SQLException {
            when(configRepo.findAll()).thenReturn(List.of());
            service.init();
            when(configRepo.existsById("AUTO_INCOME")).thenReturn(true);
            when(configRepo.findById("AUTO_INCOME")).thenReturn(Optional.of(config("AUTO_INCOME", true)));
            when(dataSource.getConnection()).thenThrow(new SQLException("no pool connection in test"));

            service.triggerNow("AUTO_INCOME");

            // markRunning() runs synchronously before the async submit() returns.
            verify(configRepo, atLeastOnce()).save(argThat(c -> "RUNNING".equals(c.getLastRunStatus())));
            // The submitted task reaching the DB step proves it actually ran on the scheduler thread.
            verify(dataSource, timeout(3000)).getConnection();
        }
    }

    // ─── getAllConfigs ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("getAllConfigs delegates to the repository")
    void getAllConfigsDelegates() {
        List<JobScheduleConfig> configs = List.of(config("AUTO_INCOME", true));
        when(configRepo.findAll()).thenReturn(configs);

        assertThat(service.getAllConfigs()).isEqualTo(configs);
    }

    // ─── runScheduled (advisory lock + dispatch), invoked directly for determinism ──

    @Nested
    @DisplayName("runScheduled (private, invoked via reflection)")
    class RunScheduledTests {

        private Connection conn;
        private PreparedStatement lockStmt;
        private PreparedStatement unlockStmt;

        @BeforeEach
        void wireJdbc() throws SQLException {
            conn = mock(Connection.class);
            lockStmt = mock(PreparedStatement.class);
            unlockStmt = mock(PreparedStatement.class);
            ResultSet lockRs = mock(ResultSet.class);
            lenient().when(dataSource.getConnection()).thenReturn(conn);
            lenient().when(conn.prepareStatement("SELECT pg_try_advisory_lock(?)")).thenReturn(lockStmt);
            lenient().when(conn.prepareStatement("SELECT pg_advisory_unlock(?)")).thenReturn(unlockStmt);
            lenient().when(lockStmt.executeQuery()).thenReturn(lockRs);
            lenient().when(lockRs.next()).thenReturn(true);
            lenient().when(lockRs.getBoolean(1)).thenReturn(true); // lock acquired by default
            lenient().when(configRepo.findById(anyString())).thenReturn(Optional.of(config("X", true)));
        }

        private void run(String jobName) {
            ReflectionTestUtils.invokeMethod(service, "runScheduled", jobName);
        }

        @Test
        @DisplayName("dispatches AUTO_INCOME, holds the advisory lock, and marks success")
        void dispatchesAutoIncomeAndMarksSuccess() throws SQLException {
            run("AUTO_INCOME");

            verify(autoIncomeScheduler).runAllAutoIncome();
            verify(unlockStmt).execute(); // lock always released
            verify(configRepo, atLeastOnce()).save(argThat(c -> "SUCCESS".equals(c.getLastRunStatus())));
        }

        @Test
        @DisplayName("dispatches every known job name to its scheduler bean")
        void dispatchesAllKnownJobs() {
            run("GOLD_PRICE");
            verify(priceRefreshScheduler).refreshGoldPrice();
            run("MF_NAV");
            verify(priceRefreshScheduler).refreshMFNav();
            run("RECURRING_EXPENSES");
            verify(recurringExpenseScheduler).processRecurringExpenses();
            run("RECURRING_INCOME");
            verify(recurringIncomeScheduler).processRecurringIncome();
            run("NET_WORTH_SNAPSHOT");
            verify(netWorthSnapshotScheduler).takeMonthlySnapshots();
            run("STOCK_WEEKLY_REFRESH");
            verify(stockDataScheduler).weeklyMasterRefresh();
            run("MF_MASTER_SYNC");
            verify(mfMasterSyncScheduler).weeklySync();
            run("LOAN_EMI");
            verify(loanEmiScheduler).processDueEmis();
            run("LOW_BALANCE_CHECK");
            verify(lowBalanceScheduler).checkAllAccounts();
            run("SPEND_ANOMALY_CHECK");
            verify(spendAnomalyScheduler).checkRecentExpenses();
            run("DEBT_DUE_REMINDER");
            verify(debtReminderScheduler).checkUpcomingDueDates();
            run("LOAN_EMI_REMINDER");
            verify(emiReminderScheduler).checkUpcomingEmis();
            run("RECURRING_TRANSFER");
            verify(recurringTransferScheduler).processRecurringTransfers();
            run("RECURRING_GOAL_CONTRIBUTION");
            verify(recurringGoalContributionScheduler).processRecurringGoalContributions();
        }

        @Test
        @DisplayName("an unknown job name is caught and recorded as FAILED, and the lock is still released")
        void unknownJobMarksFailed() throws SQLException {
            run("NOT_A_REAL_JOB");

            verify(unlockStmt).execute();
            verify(configRepo, atLeastOnce()).save(argThat(c -> "FAILED".equals(c.getLastRunStatus())
                    && c.getLastRunMessage() != null && c.getLastRunMessage().contains("Job not found")));
        }

        @Test
        @DisplayName("skips the job body entirely when the advisory lock is already held elsewhere")
        void skipsWhenLockNotAcquired() throws SQLException {
            ResultSet notAcquiredRs = mock(ResultSet.class);
            when(notAcquiredRs.next()).thenReturn(true);
            when(notAcquiredRs.getBoolean(1)).thenReturn(false);
            when(lockStmt.executeQuery()).thenReturn(notAcquiredRs);

            run("AUTO_INCOME");

            verifyNoInteractions(autoIncomeScheduler);
            verify(conn, never()).prepareStatement("SELECT pg_advisory_unlock(?)");
        }

        @Test
        @DisplayName("a failed job body still releases the advisory lock and records FAILED")
        void jobExceptionStillUnlocksAndMarksFailed() throws SQLException {
            doThrow(new RuntimeException("scheduler blew up")).when(autoIncomeScheduler).runAllAutoIncome();

            run("AUTO_INCOME");

            verify(unlockStmt).execute();
            verify(configRepo, atLeastOnce()).save(argThat(c -> "FAILED".equals(c.getLastRunStatus())
                    && "scheduler blew up".equals(c.getLastRunMessage())));
        }

        @Test
        @DisplayName("a SQLException acquiring the connection is logged and swallowed, not propagated")
        void connectionFailureIsSwallowed() throws SQLException {
            when(dataSource.getConnection()).thenThrow(new SQLException("pool exhausted"));

            org.assertj.core.api.Assertions.assertThatCode(() -> run("AUTO_INCOME")).doesNotThrowAnyException();
            verifyNoInteractions(autoIncomeScheduler);
        }

        @Test
        @DisplayName("NSE_EOD stops at the first day with updated prices and refreshes that day's corporate actions")
        void nseEodBreaksOnFirstSuccessfulDay() {
            when(stockDataService.updateEODPrices(any(LocalDate.class))).thenReturn(3);

            run("NSE_EOD");

            verify(stockDataService, times(1)).updateEODPrices(any(LocalDate.class));
            verify(stockDataService, times(1)).refreshDailyCorporateActions(any(LocalDate.class));
        }

        @Test
        @DisplayName("NSE_EOD tries all candidate days without refreshing corporate actions when none have prices")
        void nseEodExhaustsCandidatesWithoutUpdates() {
            when(stockDataService.updateEODPrices(any(LocalDate.class))).thenReturn(0);

            run("NSE_EOD");

            verify(stockDataService, atLeastOnce()).updateEODPrices(any(LocalDate.class));
            verify(stockDataService, never()).refreshDailyCorporateActions(any(LocalDate.class));
        }
    }

    // ─── markRunning / markSuccess / markFailed (package-private, called directly) ──

    @Nested
    @DisplayName("markRunning / markSuccess / markFailed")
    class MarkStatusTests {

        @Test
        @DisplayName("markRunning is a no-op when the config row no longer exists")
        void markRunningNoOpWhenMissing() {
            when(configRepo.findById("GHOST")).thenReturn(Optional.empty());

            service.markRunning("GHOST");

            verify(configRepo, never()).save(any());
        }

        @Test
        @DisplayName("markSuccess sets status SUCCESS and persists")
        void markSuccessPersists() {
            JobScheduleConfig cfg = config("AUTO_INCOME", true);
            when(configRepo.findById("AUTO_INCOME")).thenReturn(Optional.of(cfg));

            service.markSuccess("AUTO_INCOME");

            assertThat(cfg.getLastRunStatus()).isEqualTo("SUCCESS");
            verify(configRepo).save(cfg);
        }

        @Test
        @DisplayName("markFailed sets status FAILED with the error message and persists")
        void markFailedPersists() {
            JobScheduleConfig cfg = config("AUTO_INCOME", true);
            when(configRepo.findById("AUTO_INCOME")).thenReturn(Optional.of(cfg));

            service.markFailed("AUTO_INCOME", "boom");

            assertThat(cfg.getLastRunStatus()).isEqualTo("FAILED");
            assertThat(cfg.getLastRunMessage()).isEqualTo("boom");
            verify(configRepo).save(cfg);
        }
    }
}
