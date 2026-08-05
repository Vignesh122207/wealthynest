package com.wealthynest.infra.scheduler;

import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import com.wealthynest.domain.investment.repository.InvestmentRepository;
import com.wealthynest.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Entry point called by JobSchedulerService (SIP_REMINDER job). Gives a heads-up 2 days before a
 * mutual fund's SIP day — same sipDay/sipAmount fields the investment already stores, just a
 * proactive nudge rather than an automated debit (unlike LoanEmiScheduler, nothing here auto-pays
 * the SIP; the user still logs it themselves via the SIP tracking flow).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SipReminderScheduler {

    private static final int LOOKAHEAD_DAYS = 2;

    private final InvestmentRepository investmentRepository;
    private final NotificationService  notificationService;

    @Transactional(readOnly = true)
    public void checkUpcomingSips() {
        LocalDate today = LocalDate.now();
        int notified = 0;
        for (Investment inv : investmentRepository.findByInvestmentTypeAndStatus(InvestmentType.MUTUAL_FUND, LifecycleStatus.ACTIVE)) {
            try {
                if (inv.getSipDay() == null || inv.getSipAmount() == null) continue;
                if (inv.getSipDay() < 1 || inv.getSipDay() > 31) continue;
                LocalDate nextSipDate = nextSipDate(inv.getSipDay(), today);
                if (!nextSipDate.isEqual(today.plusDays(LOOKAHEAD_DAYS))) continue;
                String fundName = inv.getCompanyName() != null ? inv.getCompanyName() : "your fund";
                notificationService.createSipUpcomingNotification(inv.getUserId(), fundName, inv.getSipAmount(), nextSipDate);
                notified++;
            } catch (Exception e) {
                log.error("SIP reminder failed for investment {}: {}", inv.getId(), e.getMessage(), e);
            }
        }
        log.info("SIP reminder sweep complete: {} notification(s) sent", notified);
    }

    /**
     * The next occurrence of this fund's SIP day on or after today — rolls into next month
     * whenever this month's (clamped) SIP date has already passed. Same shape as
     * EmiReminderScheduler's nextEmiDate — kept as its own copy rather than shared, matching this
     * codebase's existing convention of one small date-clamp helper per scheduler.
     */
    private LocalDate nextSipDate(int sipDay, LocalDate today) {
        LocalDate thisMonth = clampedDate(today.getYear(), today.getMonthValue(), sipDay);
        if (!thisMonth.isBefore(today)) return thisMonth;
        LocalDate next = today.plusMonths(1);
        return clampedDate(next.getYear(), next.getMonthValue(), sipDay);
    }

    private LocalDate clampedDate(int year, int month, int day) {
        int lastDay = YearMonth.of(year, month).lengthOfMonth();
        return LocalDate.of(year, month, Math.min(day, lastDay));
    }
}
