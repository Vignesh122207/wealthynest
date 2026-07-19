package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.LoanPaymentService;
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
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoanEmiSchedulerTest {

    @Mock private WalletAccountRepository accountRepository;
    @Mock private LoanPaymentService      loanPaymentService;

    @InjectMocks
    private LoanEmiScheduler scheduler;

    private WalletAccount loan(int emiDay, Integer lastEmiYyyymm) {
        WalletAccount loan = WalletAccount.builder()
                .userId(UUID.randomUUID()).accountType(AccountType.LOAN)
                .autopayAccountId(UUID.randomUUID()).emiAmount(new BigDecimal("5000"))
                .emiDay(emiDay).lastEmiYyyymm(lastEmiYyyymm).build();
        ReflectionTestUtils.setField(loan, "id", UUID.randomUUID());
        return loan;
    }

    @Nested
    @DisplayName("processDueEmis")
    class ProcessDueEmisTests {

        @Test
        @DisplayName("pays a loan whose EMI day is today and hasn't been paid this month")
        void paysDueLoan() {
            LocalDate today = LocalDate.now();
            WalletAccount loan = loan(today.getDayOfMonth(), null);
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));
            when(loanPaymentService.processAutopay(eq(loan), anyInt())).thenReturn(true);

            scheduler.processDueEmis();

            verify(loanPaymentService).processAutopay(eq(loan), anyInt());
        }

        @Test
        @DisplayName("skips a loan not configured for autopay (missing account/amount/day)")
        void skipsUnconfiguredLoan() {
            WalletAccount loan = WalletAccount.builder()
                    .userId(UUID.randomUUID()).accountType(AccountType.LOAN)
                    .autopayAccountId(null).emiAmount(new BigDecimal("5000")).emiDay(LocalDate.now().getDayOfMonth())
                    .build();
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.processDueEmis();

            verifyNoInteractions(loanPaymentService);
        }

        @Test
        @DisplayName("skips a loan already paid this month (lastEmiYyyymm >= current)")
        void skipsAlreadyPaidThisMonth() {
            LocalDate today = LocalDate.now();
            int yyyymm = today.getYear() * 100 + today.getMonthValue();
            WalletAccount loan = loan(today.getDayOfMonth(), yyyymm);
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.processDueEmis();

            verifyNoInteractions(loanPaymentService);
        }

        @Test
        @DisplayName("skips a loan whose EMI day isn't today")
        void skipsWhenNotEmiDay() {
            LocalDate today = LocalDate.now();
            int notToday = today.getDayOfMonth() == 1 ? 2 : 1;
            WalletAccount loan = loan(notToday, null);
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));

            scheduler.processDueEmis();

            verifyNoInteractions(loanPaymentService);
        }

        @Test
        @DisplayName("clamps EMI day 31 to the last day of a shorter month")
        void clampsEmiDayToShortMonth() {
            LocalDate today = LocalDate.now();
            int lastDayOfMonth = today.lengthOfMonth();
            // Only meaningful when today IS the last day of a month shorter than 31 days.
            org.junit.jupiter.api.Assumptions.assumeTrue(lastDayOfMonth < 31 && today.getDayOfMonth() == lastDayOfMonth);
            WalletAccount loan = loan(31, null);
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)).thenReturn(List.of(loan));
            when(loanPaymentService.processAutopay(eq(loan), anyInt())).thenReturn(true);

            scheduler.processDueEmis();

            verify(loanPaymentService).processAutopay(eq(loan), anyInt());
        }

        @Test
        @DisplayName("continues processing remaining loans when one throws")
        void continuesAfterException() {
            LocalDate today = LocalDate.now();
            WalletAccount failing = loan(today.getDayOfMonth(), null);
            WalletAccount succeeding = loan(today.getDayOfMonth(), null);
            when(accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN))
                    .thenReturn(List.of(failing, succeeding));
            when(loanPaymentService.processAutopay(eq(failing), anyInt())).thenThrow(new RuntimeException("boom"));
            when(loanPaymentService.processAutopay(eq(succeeding), anyInt())).thenReturn(true);

            scheduler.processDueEmis();

            verify(loanPaymentService).processAutopay(eq(succeeding), anyInt());
        }
    }
}
