package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.notification.service.NotificationService;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmiReminderSchedulerTest {

    @Mock private WalletAccountRepository accountRepository;
    @Mock private NotificationService     notificationService;

    @InjectMocks
    private EmiReminderScheduler scheduler;

    private WalletAccount loan(int emiDay) {
        WalletAccount loan = WalletAccount.builder()
                .userId(UUID.randomUUID()).accountType(AccountType.LOAN).name("Home Loan")
                .autopayAccountId(UUID.randomUUID()).emiAmount(new BigDecimal("15000")).emiDay(emiDay).build();
        ReflectionTestUtils.setField(loan, "id", UUID.randomUUID());
        return loan;
    }

    @Nested
    @DisplayName("checkUpcomingEmis")
    class CheckUpcomingEmisTests {

        @Test
        @DisplayName("notifies when the next EMI date is exactly 2 days from today")
        void notifiesWhenTwoDaysAhead() {
            LocalDate target = LocalDate.now().plusDays(2);
            WalletAccount loan = loan(target.getDayOfMonth());
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.checkUpcomingEmis();

            verify(notificationService).createEmiUpcomingNotification(
                    loan.getUserId(), "Home Loan", loan.getEmiAmount(), target);
        }

        @Test
        @DisplayName("does not notify when the next EMI date is not exactly 2 days away")
        void skipsWhenNotTwoDaysAhead() {
            LocalDate target = LocalDate.now().plusDays(5);
            WalletAccount loan = loan(target.getDayOfMonth());
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.checkUpcomingEmis();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("skips a loan not configured for autopay")
        void skipsUnconfiguredLoan() {
            WalletAccount loan = WalletAccount.builder()
                    .userId(UUID.randomUUID()).accountType(AccountType.LOAN)
                    .emiAmount(new BigDecimal("1000")).emiDay(1).autopayAccountId(null).build();
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.checkUpcomingEmis();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("rolls into next month once this month's EMI date has already passed")
        void rollsIntoNextMonthWhenPassed() {
            LocalDate today = LocalDate.now();
            // EMI day 1 dropped to "yesterday or earlier" this month (or already rolled if today is
            // the 1st) forces the "thisMonth date is before today" branch, landing on next month's day 1.
            LocalDate expectedNext = today.getDayOfMonth() == 1 ? today : today.plusMonths(1).withDayOfMonth(1);
            org.junit.jupiter.api.Assumptions.assumeTrue(!expectedNext.isEqual(today.plusDays(2)));
            WalletAccount loan = loan(1);
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.checkUpcomingEmis();

            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("continues processing remaining loans when one throws")
        void continuesAfterException() {
            LocalDate target = LocalDate.now().plusDays(2);
            WalletAccount failing = loan(target.getDayOfMonth());
            WalletAccount succeeding = loan(target.getDayOfMonth());
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN))
                    .thenReturn(List.of(failing, succeeding));
            doThrow(new RuntimeException("boom")).when(notificationService)
                    .createEmiUpcomingNotification(eq(failing.getUserId()), any(), any(), any());

            scheduler.checkUpcomingEmis();

            verify(notificationService).createEmiUpcomingNotification(
                    eq(succeeding.getUserId()), any(), any(), any());
        }
    }
}
