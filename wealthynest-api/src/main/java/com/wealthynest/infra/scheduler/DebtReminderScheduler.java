package com.wealthynest.infra.scheduler;

import com.wealthynest.domain.debt.entity.DebtRecord;
import com.wealthynest.domain.debt.entity.DebtStatus;
import com.wealthynest.domain.debt.repository.DebtRecordRepository;
import com.wealthynest.domain.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;

/**
 * Entry point called by JobSchedulerService (DEBT_DUE_REMINDER job). Fires a reminder 3 days
 * before an active personal debt's due date, and again on the due date itself — the notification's
 * own once-per-day dedup (by title) keeps this idempotent across reruns.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DebtReminderScheduler {

    private static final int LOOKAHEAD_DAYS = 3;

    private final DebtRecordRepository debtRecordRepository;
    private final NotificationService  notificationService;

    @Transactional(readOnly = true)
    public void checkUpcomingDueDates() {
        LocalDate today = LocalDate.now();
        int notified = 0;
        for (DebtRecord debt : debtRecordRepository.findByStatusAndDueDateIsNotNull(DebtStatus.ACTIVE)) {
            try {
                LocalDate due = debt.getDueDate();
                boolean dueSoon = due.isEqual(today) || due.isEqual(today.plusDays(LOOKAHEAD_DAYS));
                if (!dueSoon) continue;
                notificationService.createDebtDueNotification(
                        debt.getUserId(), debt.getContactName(), debt.getAmount(), due, debt.getType().name());
                notified++;
            } catch (Exception e) {
                log.error("Debt reminder failed for debt {}: {}", debt.getId(), e.getMessage());
            }
        }
        log.info("Debt reminder sweep complete: {} notification(s) sent", notified);
    }
}
