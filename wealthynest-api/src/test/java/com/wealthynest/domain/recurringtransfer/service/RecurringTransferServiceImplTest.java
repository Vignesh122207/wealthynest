package com.wealthynest.domain.recurringtransfer.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.dto.request.TransferRequest;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.recurringtransfer.dto.request.CreateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.dto.request.UpdateRecurringTransferRequest;
import com.wealthynest.domain.recurringtransfer.entity.RecurringTransfer;
import com.wealthynest.domain.recurringtransfer.repository.RecurringTransferRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringTransferServiceImplTest {

    @Mock private RecurringTransferRepository recurringTransferRepository;
    @Mock private WalletAccountRepository     walletAccountRepository;
    @Mock private AccountOwnershipGuard       accountOwnershipGuard;
    @Mock private WalletAccountService        walletAccountService;

    @InjectMocks
    private RecurringTransferServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final UUID fromAccountId = UUID.randomUUID();
    private final UUID toAccountId   = UUID.randomUUID();
    private final UUID ruleId = UUID.randomUUID();

    @BeforeEach
    void stubAccountNameLookups() {
        lenient().when(walletAccountRepository.findById(any())).thenReturn(Optional.empty());
    }

    private RecurringTransfer.RecurringTransferBuilder baseRule(int dayOfMonth) {
        return RecurringTransfer.builder().userId(userId).fromAccountId(fromAccountId).toAccountId(toAccountId)
                .amount(new BigDecimal("1000")).dayOfMonth(dayOfMonth).active(true);
    }

    private RecurringTransfer withId(RecurringTransfer r) {
        ReflectionTestUtils.setField(r, "id", ruleId);
        return r;
    }

    private WalletAccount walletAccountOf(UUID id, String name) {
        WalletAccount account = WalletAccount.builder().userId(userId).name(name).build();
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }

    // ─── getAll ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAll")
    class GetAllTests {

        @Test
        @DisplayName("maps each rule to a response, resolving both account names via a batched lookup")
        void mapsRulesToResponses() {
            RecurringTransfer rule = withId(baseRule(1).build());
            WalletAccount fromAccount = walletAccountOf(fromAccountId, "From Wallet");
            WalletAccount toAccount   = walletAccountOf(toAccountId, "To Wallet");
            when(recurringTransferRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(rule));
            when(walletAccountRepository.findAllById(List.of(fromAccountId, toAccountId)))
                    .thenReturn(List.of(fromAccount, toAccount));

            var result = service.getAll(userId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getFromAccountName()).isEqualTo("From Wallet");
            assertThat(result.get(0).getToAccountName()).isEqualTo("To Wallet");
        }

        @Test
        @DisplayName("a linked account no longer existing falls back to \"Unknown Account\" for just that side")
        void missingAccount_fallsBackToUnknownAccount() {
            RecurringTransfer rule = withId(baseRule(1).build());
            WalletAccount toAccount = walletAccountOf(toAccountId, "To Wallet");
            when(recurringTransferRepository.findByUserIdOrderByCreatedAtDesc(userId)).thenReturn(List.of(rule));
            when(walletAccountRepository.findAllById(List.of(fromAccountId, toAccountId)))
                    .thenReturn(List.of(toAccount));

            var result = service.getAll(userId);

            assertThat(result.get(0).getFromAccountName()).isEqualTo("Unknown Account");
            assertThat(result.get(0).getToAccountName()).isEqualTo("To Wallet");
        }
    }

    // ─── create ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class CreateTests {

        @Test
        @DisplayName("rejects identical from/to accounts")
        void rejectsSameAccount() {
            CreateRecurringTransferRequest req = mock(CreateRecurringTransferRequest.class);
            when(req.getFromAccountId()).thenReturn(fromAccountId);
            when(req.getToAccountId()).thenReturn(fromAccountId);

            assertThatThrownBy(() -> service.create(userId, req)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(accountOwnershipGuard);
        }

        @Test
        @DisplayName("validates ownership of both accounts")
        void validatesOwnershipOfBothAccounts() {
            CreateRecurringTransferRequest req = mock(CreateRecurringTransferRequest.class);
            when(req.getFromAccountId()).thenReturn(fromAccountId);
            when(req.getToAccountId()).thenReturn(toAccountId);
            when(req.getAmount()).thenReturn(new BigDecimal("500"));
            when(req.getDayOfMonth()).thenReturn(5);
            when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            service.create(userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(fromAccountId, userId);
            verify(accountOwnershipGuard).validateAccountOwnership(toAccountId, userId);
        }
    }

    // ─── update ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update")
    class UpdateTests {

        @Test
        @DisplayName("throws when not found or not owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(recurringTransferRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.empty());
            UpdateRecurringTransferRequest req = mock(UpdateRecurringTransferRequest.class);
            assertThatThrownBy(() -> service.update(ruleId, userId, req)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("does not re-validate accounts when neither fromAccountId nor toAccountId changes")
        void skipsRevalidationWhenAccountsUnchanged() {
            RecurringTransfer rule = withId(baseRule(5).build());
            when(recurringTransferRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.of(rule));
            when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateRecurringTransferRequest req = mock(UpdateRecurringTransferRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("2000"));

            service.update(ruleId, userId, req);

            verifyNoInteractions(accountOwnershipGuard);
            assertThat(rule.getAmount()).isEqualByComparingTo("2000");
        }

        @Test
        @DisplayName("re-validates using the NEW account against the OLD one when only one side changes")
        void revalidatesWithNewAndOldAccountMixed() {
            RecurringTransfer rule = withId(baseRule(5).build());
            when(recurringTransferRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.of(rule));
            when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> inv.getArgument(0));
            UUID newFrom = UUID.randomUUID();
            UpdateRecurringTransferRequest req = mock(UpdateRecurringTransferRequest.class);
            when(req.getFromAccountId()).thenReturn(newFrom);

            service.update(ruleId, userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(newFrom, userId);
            verify(accountOwnershipGuard).validateAccountOwnership(toAccountId, userId); // old "to" retained
            assertThat(rule.getFromAccountId()).isEqualTo(newFrom);
        }
    }

    // ─── toggleActive / delete ───────────────────────────────────────────────────

    @Test
    @DisplayName("toggleActive flips the active flag both ways")
    void toggleActiveFlipsFlag() {
        RecurringTransfer rule = withId(baseRule(5).active(true).build());
        when(recurringTransferRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.of(rule));
        when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> inv.getArgument(0));

        service.toggleActive(ruleId, userId);
        assertThat(rule.isActive()).isFalse();

        service.toggleActive(ruleId, userId);
        assertThat(rule.isActive()).isTrue();
    }

    @Test
    @DisplayName("delete removes an owned rule")
    void deleteRemovesOwnedRule() {
        RecurringTransfer rule = withId(baseRule(5).build());
        when(recurringTransferRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.of(rule));

        service.delete(ruleId, userId);

        verify(recurringTransferRepository).delete(rule);
    }

    // ─── processScheduled ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("processScheduled")
    class ProcessScheduledTests {

        private final LocalDate today = LocalDate.now();
        private final int yyyymm = today.getYear() * 100 + today.getMonthValue();

        @Test
        @DisplayName("skips a rule whose fixed day-of-month isn't today")
        void skipsWhenNotTransferDay() {
            int notToday = today.getDayOfMonth() == 1 ? 2 : 1;
            RecurringTransfer rule = withId(baseRule(notToday).build());
            when(recurringTransferRepository.findByActiveTrue()).thenReturn(List.of(rule));

            service.processScheduled();

            verifyNoInteractions(walletAccountService);
        }

        @Test
        @DisplayName("transfers on the matching fixed day-of-month and records the month/timestamp")
        void transfersOnMatchingDay() {
            RecurringTransfer rule = withId(baseRule(today.getDayOfMonth()).build());
            when(recurringTransferRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> inv.getArgument(0));

            service.processScheduled();

            verify(walletAccountService).transfer(eq(userId), any(TransferRequest.class));
            assertThat(rule.getLastTransferredMonth()).isEqualTo(yyyymm);
            assertThat(rule.getLastTransferredAt()).isNotNull();
        }

        @Test
        @DisplayName("skips a rule already transferred this month, even if today matches its day")
        void skipsWhenAlreadyTransferredThisMonth() {
            RecurringTransfer rule = withId(baseRule(today.getDayOfMonth()).build());
            rule.setLastTransferredMonth(yyyymm);
            when(recurringTransferRepository.findByActiveTrue()).thenReturn(List.of(rule));

            service.processScheduled();

            verifyNoInteractions(walletAccountService);
        }

        @Test
        @DisplayName("dayOfMonth=0 fires only on the month's actual last working day")
        void zeroDayFiresOnlyOnLastWorkingDay() {
            LocalDate lastWorkingDay = YearMonth.of(today.getYear(), today.getMonthValue()).atEndOfMonth();
            while (lastWorkingDay.getDayOfWeek().getValue() >= 6) lastWorkingDay = lastWorkingDay.minusDays(1);
            org.junit.jupiter.api.Assumptions.assumeTrue(today.equals(lastWorkingDay),
                    "This assertion only applies when run ON the last working day of the month");

            RecurringTransfer rule = withId(baseRule(0).build());
            when(recurringTransferRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> inv.getArgument(0));

            service.processScheduled();

            verify(walletAccountService).transfer(eq(userId), any(TransferRequest.class));
        }

        @Test
        @DisplayName("a failure processing one rule is logged and swallowed, not propagated to the caller")
        void perRuleFailureIsSwallowed() {
            RecurringTransfer rule = withId(baseRule(today.getDayOfMonth()).build());
            when(recurringTransferRepository.findByActiveTrue()).thenReturn(List.of(rule));
            doThrow(new RuntimeException("transfer failed")).when(walletAccountService).transfer(any(), any());

            service.processScheduled(); // must not throw

            verify(recurringTransferRepository, never()).save(any());
        }

        @Test
        @DisplayName("the transfer request carries the rule's own amount/accounts and defaults description when blank")
        void buildsTransferRequestFromRule() {
            RecurringTransfer rule = withId(baseRule(today.getDayOfMonth()).amount(new BigDecimal("777")).description(null).build());
            when(recurringTransferRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(inv -> inv.getArgument(0));
            var captor = org.mockito.ArgumentCaptor.forClass(TransferRequest.class);

            service.processScheduled();

            verify(walletAccountService).transfer(eq(userId), captor.capture());
            assertThat(captor.getValue().getAmount()).isEqualByComparingTo("777");
            assertThat(captor.getValue().getFromAccountId()).isEqualTo(fromAccountId);
            assertThat(captor.getValue().getDescription()).isEqualTo("Auto-transfer");
        }
    }
}
