package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.account.entity.AccountType;
import com.wealthynest.domain.account.entity.WalletAccount;
import com.wealthynest.domain.account.repository.WalletAccountRepository;
import com.wealthynest.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Entry point called by JobSchedulerService (LOAN_EMI_REMINDER job). Gives a heads-up 2 days
 * before LoanEmiScheduler's autopay silently debits the account — same emiDay/emiAmount fields
 * that scheduler already reads, just an earlier warning instead of a same-day autopay.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmiReminderScheduler {

    private static final int LOOKAHEAD_DAYS = 2;

    private final WalletAccountRepository accountRepository;
    private final NotificationService     notificationService;

    @Transactional(readOnly = true)
    public void checkUpcomingEmis() {
        LocalDate today = LocalDate.now();
        int notified = 0;
        for (WalletAccount loan : accountRepository.findByAccountTypeAndArchivedFalse(AccountType.LOAN)) {
            try {
                if (loan.getAutopayAccountId() == null || loan.getEmiAmount() == null || loan.getEmiDay() == null) continue;
                LocalDate nextEmiDate = nextEmiDate(loan.getEmiDay(), today);
                if (!nextEmiDate.isEqual(today.plusDays(LOOKAHEAD_DAYS))) continue;
                notificationService.createEmiUpcomingNotification(loan.getUserId(), loan.getName(), loan.getEmiAmount(), nextEmiDate);
                notified++;
            } catch (Exception e) {
                log.error("EMI reminder failed for loan {}: {}", loan.getId(), e.getMessage());
            }
        }
        log.info("EMI reminder sweep complete: {} notification(s) sent", notified);
    }

    /**
     * The next occurrence of this loan's EMI day on or after today — rolls into next month
     * whenever this month's (clamped) EMI date has already passed.
     */
    private LocalDate nextEmiDate(int emiDay, LocalDate today) {
        LocalDate thisMonth = clampedDate(today.getYear(), today.getMonthValue(), emiDay);
        if (!thisMonth.isBefore(today)) return thisMonth;
        LocalDate next = today.plusMonths(1);
        return clampedDate(next.getYear(), next.getMonthValue(), emiDay);
    }

    private LocalDate clampedDate(int year, int month, int day) {
        int lastDay = YearMonth.of(year, month).lengthOfMonth();
        return LocalDate.of(year, month, Math.min(day, lastDay));
    }
}
