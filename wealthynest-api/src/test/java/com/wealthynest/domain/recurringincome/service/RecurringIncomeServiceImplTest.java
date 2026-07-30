package com.wealthynest.domain.recurringincome.service;

import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.income.dto.request.CreateIncomeRequest;
import com.wealthynest.domain.income.entity.IncomePaymentMode;
import com.wealthynest.domain.income.service.IncomeService;
import com.wealthynest.domain.recurringincome.dto.request.CreateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.dto.request.UpdateRecurringIncomeRequest;
import com.wealthynest.domain.recurringincome.entity.RecurringIncome;
import com.wealthynest.domain.recurringincome.repository.RecurringIncomeRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringIncomeServiceImplTest {

    @Mock private RecurringIncomeRepository recurringIncomeRepository;
    @Mock private WalletAccountRepository   walletAccountRepository;
    @Mock private IncomeService             incomeService;
    @Mock private AccountOwnershipGuard     accountOwnershipGuard;

    @InjectMocks
    private RecurringIncomeServiceImpl service;

    // ── Shared factory helpers ────────────────────────────────────────────────────

    /**
     * Builds an active {@link RecurringIncome} rule.
     *
     * @param dayOfMonth          1–31 = fixed calendar day; 0 = last working day
     * @param lastCreditedMonth   null = never credited; yyyymm = already credited that month
     */
    private RecurringIncome buildRule(int dayOfMonth, Integer lastCreditedMonth) {
        RecurringIncome rule = RecurringIncome.builder()
            .userId(UUID.randomUUID())
            .accountId(UUID.randomUUID())
            .source("SALARY")
            .amount(new BigDecimal("50000.00"))
            .description("Monthly salary credit")
            .dayOfMonth(dayOfMonth)
            .active(true)
            .build();
        rule.setLastCreditedMonth(lastCreditedMonth);
        return rule;
    }

    private WalletAccount walletAccountOf(AccountType type) {
        WalletAccount account = WalletAccount.builder()
            .userId(UUID.randomUUID())
            .accountType(type)
            .name(type.name())
            .build();
        ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
        return account;
    }

    /** Returns a day-of-month guaranteed to differ from today's day-of-month. */
    private int notTodayDayOfMonth() {
        int today = LocalDate.now().getDayOfMonth();
        return today == 15 ? 16 : 15;
    }

    // ─── ProcessScheduledTests ────────────────────────────────────────────────────

    @Nested
    @DisplayName("processScheduled")
    class ProcessScheduledTests {

        @Test
        @DisplayName("no active rules → incomeService never called")
        void noActiveRules_nothingCredited() {
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(Collections.emptyList());

            service.processScheduled();

            verifyNoInteractions(incomeService);
            verify(recurringIncomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("rule dayOfMonth does not match today → rule skipped")
        void ruleNotOnCreditDay_skipped() {
            RecurringIncome rule = buildRule(notTodayDayOfMonth(), null);
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));

            service.processScheduled();

            verifyNoInteractions(incomeService);
            verify(recurringIncomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("rule matches today but already credited this month → rule skipped")
        void alreadyCreditedThisMonth_skipped() {
            LocalDate today  = LocalDate.now();
            int yyyymm = today.getYear() * 100 + today.getMonthValue();
            RecurringIncome rule = buildRule(today.getDayOfMonth(), yyyymm);
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));

            service.processScheduled();

            verifyNoInteractions(incomeService);
            verify(recurringIncomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("rule matches today and never credited → income created and rule lastCreditedMonth updated")
        void happyPath_fixedDay_incomeCreatedAndMonthUpdated() {
            LocalDate today  = LocalDate.now();
            int yyyymm = today.getYear() * 100 + today.getMonthValue();
            RecurringIncome rule = buildRule(today.getDayOfMonth(), null);
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(walletAccountRepository.findById(rule.getAccountId()))
                .thenReturn(Optional.of(walletAccountOf(AccountType.BANK_ACCOUNT)));
            when(recurringIncomeRepository.save(any())).thenReturn(rule);

            service.processScheduled();

            verify(incomeService).create(eq(rule.getUserId()), any(CreateIncomeRequest.class));
            ArgumentCaptor<RecurringIncome> captor = ArgumentCaptor.forClass(RecurringIncome.class);
            verify(recurringIncomeRepository).save(captor.capture());
            assertThat(captor.getValue().getLastCreditedMonth()).isEqualTo(yyyymm);
            assertThat(captor.getValue().getLastCreditedAt()).isNotNull();
        }

        @Test
        @DisplayName("dayOfMonth=0 (last working day) → credited when today is the last working day of month")
        void dayOfMonth0_lastWorkingDay_credited() {
            // October 31, 2025 is a Friday — guaranteed last working day of October 2025
            LocalDate lastWorkingDayOfOct = LocalDate.of(2025, 10, 31);
            assertThat(lastWorkingDayOfOct.getDayOfWeek())
                .isNotIn(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY); // sanity-check

            try (MockedStatic<LocalDate> mockedDate =
                     Mockito.mockStatic(LocalDate.class, Mockito.CALLS_REAL_METHODS)) {
                mockedDate.when(LocalDate::now).thenReturn(lastWorkingDayOfOct);

                int yyyymm = 202510;
                RecurringIncome rule = buildRule(0, null); // 0 = last working day
                when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));
                when(walletAccountRepository.findById(rule.getAccountId()))
                    .thenReturn(Optional.of(walletAccountOf(AccountType.BANK_ACCOUNT)));
                when(recurringIncomeRepository.save(any())).thenReturn(rule);

                service.processScheduled();

                verify(incomeService).create(eq(rule.getUserId()), any(CreateIncomeRequest.class));
                ArgumentCaptor<RecurringIncome> captor = ArgumentCaptor.forClass(RecurringIncome.class);
                verify(recurringIncomeRepository).save(captor.capture());
                assertThat(captor.getValue().getLastCreditedMonth()).isEqualTo(yyyymm);
            }
        }

        @Test
        @DisplayName("dayOfMonth=31 in a 28-day month (February) → clamped to last day and credited")
        void day31InFebruary_clampedToLastDay_credited() {
            // February 28, 2025 — a 28-day month; day 31 clamps to 28
            LocalDate feb28 = LocalDate.of(2025, 2, 28);
            assertThat(YearMonth.of(2025, 2).lengthOfMonth()).isEqualTo(28);

            try (MockedStatic<LocalDate> mockedDate =
                     Mockito.mockStatic(LocalDate.class, Mockito.CALLS_REAL_METHODS)) {
                mockedDate.when(LocalDate::now).thenReturn(feb28);

                int yyyymm = 202502;
                RecurringIncome rule = buildRule(31, null);
                when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));
                when(walletAccountRepository.findById(rule.getAccountId()))
                    .thenReturn(Optional.of(walletAccountOf(AccountType.BANK_ACCOUNT)));
                when(recurringIncomeRepository.save(any())).thenReturn(rule);

                service.processScheduled();

                verify(incomeService).create(eq(rule.getUserId()), any(CreateIncomeRequest.class));
                ArgumentCaptor<RecurringIncome> captor = ArgumentCaptor.forClass(RecurringIncome.class);
                verify(recurringIncomeRepository).save(captor.capture());
                assertThat(captor.getValue().getLastCreditedMonth()).isEqualTo(yyyymm);
            }
        }

        @Test
        @DisplayName("linked account is CASH_WALLET → payment mode passed to incomeService is CASH")
        void cashWalletAccount_paymentModeIsCash() {
            LocalDate today = LocalDate.now();
            RecurringIncome rule = buildRule(today.getDayOfMonth(), null);
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(walletAccountRepository.findById(rule.getAccountId()))
                .thenReturn(Optional.of(walletAccountOf(AccountType.CASH_WALLET)));
            when(recurringIncomeRepository.save(any())).thenReturn(rule);

            service.processScheduled();

            ArgumentCaptor<CreateIncomeRequest> reqCaptor =
                ArgumentCaptor.forClass(CreateIncomeRequest.class);
            verify(incomeService).create(eq(rule.getUserId()), reqCaptor.capture());
            assertThat(reqCaptor.getValue().getPaymentMode()).isEqualTo(IncomePaymentMode.CASH);
        }

        @Test
        @DisplayName("linked account is BANK_ACCOUNT → payment mode passed to incomeService is BANK_ACCOUNT")
        void bankAccount_paymentModeIsBankAccount() {
            LocalDate today = LocalDate.now();
            RecurringIncome rule = buildRule(today.getDayOfMonth(), null);
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(walletAccountRepository.findById(rule.getAccountId()))
                .thenReturn(Optional.of(walletAccountOf(AccountType.BANK_ACCOUNT)));
            when(recurringIncomeRepository.save(any())).thenReturn(rule);

            service.processScheduled();

            ArgumentCaptor<CreateIncomeRequest> reqCaptor =
                ArgumentCaptor.forClass(CreateIncomeRequest.class);
            verify(incomeService).create(eq(rule.getUserId()), reqCaptor.capture());
            assertThat(reqCaptor.getValue().getPaymentMode()).isEqualTo(IncomePaymentMode.BANK_ACCOUNT);
        }

        @Test
        @DisplayName("incomeService.create throws → exception swallowed, rule NOT saved, no propagation")
        void incomeServiceThrows_ruleSavedAsFailedGracefully() {
            LocalDate today = LocalDate.now();
            RecurringIncome rule = buildRule(today.getDayOfMonth(), null);
            when(recurringIncomeRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(walletAccountRepository.findById(rule.getAccountId()))
                .thenReturn(Optional.of(walletAccountOf(AccountType.BANK_ACCOUNT)));
            doThrow(new RuntimeException("Income service failure"))
                .when(incomeService).create(any(), any());

            // Must not propagate — processScheduled swallows rule-level exceptions
            org.assertj.core.api.Assertions.assertThatCode(() -> service.processScheduled())
                .doesNotThrowAnyException();

            // Rule must NOT be saved when the income creation failed
            verify(recurringIncomeRepository, never()).save(any());
        }

        @Test
        @DisplayName("two rules, only one matches today's credit day → only matching rule gets income created")
        void multipleRules_onlyMatchingDayOnesProcessed() {
            LocalDate today    = LocalDate.now();
            int matchingDay    = today.getDayOfMonth();
            int nonMatchingDay = today.getDayOfMonth() == 15 ? 16 : 15;

            RecurringIncome matchingRule    = buildRule(matchingDay,    null);
            RecurringIncome nonMatchingRule = buildRule(nonMatchingDay, null);

            when(recurringIncomeRepository.findByActiveTrue())
                .thenReturn(List.of(matchingRule, nonMatchingRule));
            when(walletAccountRepository.findById(matchingRule.getAccountId()))
                .thenReturn(Optional.of(walletAccountOf(AccountType.BANK_ACCOUNT)));
            when(recurringIncomeRepository.save(any())).thenReturn(matchingRule);

            service.processScheduled();

            // incomeService called exactly once — for the matching rule only
            verify(incomeService).create(eq(matchingRule.getUserId()), any(CreateIncomeRequest.class));
            verify(incomeService, never()).create(eq(nonMatchingRule.getUserId()), any());
            // Only the matching rule is persisted
            verify(recurringIncomeRepository).save(matchingRule);
        }
    }

    // ─── CRUD ─────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAll")
    class GetAllTests {

        @Test
        @DisplayName("maps each rule to a response, resolving the account name via a batched lookup")
        void mapsRulesToResponses() {
            UUID userId = UUID.randomUUID();
            RecurringIncome rule = buildRule(1, null);
            WalletAccount account = walletAccountOf(AccountType.BANK_ACCOUNT);
            ReflectionTestUtils.setField(account, "id", rule.getAccountId());
            when(recurringIncomeRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(rule));
            when(walletAccountRepository.findAllById(List.of(rule.getAccountId()))).thenReturn(List.of(account));

            var result = service.getAll(userId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getAccountName()).isEqualTo(account.getName());
        }

        @Test
        @DisplayName("linked account no longer exists → accountName falls back to \"Unknown Account\"")
        void missingAccount_fallsBackToUnknownAccount() {
            UUID userId = UUID.randomUUID();
            RecurringIncome rule = buildRule(1, null);
            when(recurringIncomeRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(rule));
            when(walletAccountRepository.findAllById(List.of(rule.getAccountId()))).thenReturn(List.of());

            var result = service.getAll(userId);

            assertThat(result.get(0).getAccountName()).isEqualTo("Unknown Account");
        }
    }

    @Nested
    @DisplayName("create")
    class CreateTests {

        @Test
        @DisplayName("validates account ownership then saves a new active rule")
        void validatesOwnershipAndSaves() {
            UUID userId = UUID.randomUUID();
            UUID accountId = UUID.randomUUID();
            CreateRecurringIncomeRequest req = new CreateRecurringIncomeRequest();
            ReflectionTestUtils.setField(req, "accountId", accountId);
            ReflectionTestUtils.setField(req, "source", "SALARY");
            ReflectionTestUtils.setField(req, "amount", new BigDecimal("50000"));
            ReflectionTestUtils.setField(req, "dayOfMonth", 1);
            when(recurringIncomeRepository.save(any(RecurringIncome.class))).thenAnswer(inv -> inv.getArgument(0));
            when(walletAccountRepository.findById(accountId)).thenReturn(Optional.empty());

            var result = service.create(userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(accountId, userId);
            assertThat(result.getSource()).isEqualTo("SALARY");
            ArgumentCaptor<RecurringIncome> captor = ArgumentCaptor.forClass(RecurringIncome.class);
            verify(recurringIncomeRepository).save(captor.capture());
            assertThat(captor.getValue().isActive()).isTrue();
        }
    }

    @Nested
    @DisplayName("update")
    class UpdateTests {

        @Test
        @DisplayName("unknown rule id → throws ResourceNotFoundException")
        void unknownRule_throws() {
            UUID id = UUID.randomUUID();
            UUID userId = UUID.randomUUID();
            when(recurringIncomeRepository.findByIdAndUserId(id, userId)).thenReturn(Optional.empty());

            org.assertj.core.api.Assertions.assertThatThrownBy(
                    () -> service.update(id, userId, new UpdateRecurringIncomeRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("only non-null fields are applied; a new accountId re-validates ownership")
        void appliesOnlyNonNullFields() {
            RecurringIncome rule = buildRule(1, null);
            ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
            UUID newAccountId = UUID.randomUUID();
            when(recurringIncomeRepository.findByIdAndUserId(rule.getId(), rule.getUserId()))
                .thenReturn(Optional.of(rule));
            when(recurringIncomeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(walletAccountRepository.findById(any())).thenReturn(Optional.empty());

            UpdateRecurringIncomeRequest req = new UpdateRecurringIncomeRequest();
            ReflectionTestUtils.setField(req, "accountId", newAccountId);
            ReflectionTestUtils.setField(req, "amount", new BigDecimal("75000"));

            service.update(rule.getId(), rule.getUserId(), req);

            verify(accountOwnershipGuard).validateAccountOwnership(newAccountId, rule.getUserId());
            assertThat(rule.getAccountId()).isEqualTo(newAccountId);
            assertThat(rule.getAmount()).isEqualByComparingTo("75000");
            assertThat(rule.getSource()).isEqualTo("SALARY"); // untouched — request field was null
        }
    }

    @Nested
    @DisplayName("toggleActive")
    class ToggleActiveTests {

        @Test
        @DisplayName("flips the active flag and persists")
        void flipsActiveFlag() {
            RecurringIncome rule = buildRule(1, null);
            ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
            when(recurringIncomeRepository.findByIdAndUserId(rule.getId(), rule.getUserId()))
                .thenReturn(Optional.of(rule));
            when(recurringIncomeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(walletAccountRepository.findById(any())).thenReturn(Optional.empty());

            service.toggleActive(rule.getId(), rule.getUserId());

            assertThat(rule.isActive()).isFalse();
        }
    }

    @Nested
    @DisplayName("delete")
    class DeleteTests {

        @Test
        @DisplayName("deletes the owned rule")
        void deletesOwnedRule() {
            RecurringIncome rule = buildRule(1, null);
            ReflectionTestUtils.setField(rule, "id", UUID.randomUUID());
            when(recurringIncomeRepository.findByIdAndUserId(rule.getId(), rule.getUserId()))
                .thenReturn(Optional.of(rule));

            service.delete(rule.getId(), rule.getUserId());

            verify(recurringIncomeRepository).delete(rule);
        }
    }
}
