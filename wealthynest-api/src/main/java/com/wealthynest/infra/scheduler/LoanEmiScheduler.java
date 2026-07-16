package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.account.service.LoanPaymentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * EMI autopay — entry point called by JobSchedulerService (LOAN_EMI job, configurable/triggerable
 * from Admin). Runs daily; pays each active loan whose EMI day is today (clamped to short months)
 * and that hasn't been paid this month yet. Each payment is split into interest (expense) and
 * principal (transfer) by LoanPaymentService.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LoanEmiScheduler {

    private final WalletAccountRepository accountRepository;
    private final LoanPaymentService      loanPaymentService;

    public void processDueEmis() {
        LocalDate today = LocalDate.now();
        int yyyymm = today.getYear() * 100 + today.getMonthValue();

        List<WalletAccount> loans = accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN);
        int paid = 0;
        for (WalletAccount loan : loans) {
            try {
                if (loan.getAutopayAccountId() == null || loan.getEmiAmount() == null || loan.getEmiDay() == null) continue;
                if (loan.getLastEmiYyyymm() != null && loan.getLastEmiYyyymm() >= yyyymm) continue;
                if (!isEmiDay(loan.getEmiDay(), today)) continue;
                if (loanPaymentService.processAutopay(loan, yyyymm)) paid++;
            } catch (Exception e) {
                log.error("EMI autopay failed for loan {}: {}", loan.getId(), e.getMessage());
            }
        }
        log.info("Loan EMI run: {} EMI(s) paid on {}", paid, today);
    }

    /** EMI day clamped to the month's length (rule day 28+ in February pays on the last day). */
    private boolean isEmiDay(int emiDay, LocalDate today) {
        int lastDay = YearMonth.of(today.getYear(), today.getMonthValue()).lengthOfMonth();
        return today.getDayOfMonth() == Math.min(emiDay, lastDay);
    }
}
