package com.wealthynest.domain.notification.service;

import com.wealthynest.domain.notification.dto.response.NotificationResponse;
import com.wealthynest.domain.notification.entity.Notification;
import com.wealthynest.domain.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {
    private final NotificationRepository notificationRepository;

    @Override @Transactional(readOnly = true)
    public Page<NotificationResponse> getNotifications(UUID userId, Pageable pageable) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(n -> NotificationResponse.builder()
                        .id(n.getId()).type(n.getType()).title(n.getTitle())
                        .message(n.getMessage()).read(n.isRead()).createdAt(n.getCreatedAt())
                        .build());
    }

    @Override @Transactional(readOnly = true)
    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    @Override @Transactional
    public void markAllRead(UUID userId) {
        notificationRepository.markAllReadByUserId(userId);
    }

    @Override @Transactional
    public void createBudgetBreachNotification(UUID userId, String categoryName,
                                               BigDecimal spent, BigDecimal budget, double pct) {
        String title = "Budget Alert: " + categoryName;
        // Deduplicate — one alert per category per day
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "BUDGET_ALERT", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "You've used %.0f%% of your %s budget (spent ₹%.0f of ₹%.0f).",
            pct, categoryName, spent, budget);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("BUDGET_ALERT")
                .title(title)
                .message(message)
                .build());
    }

    @Override @Transactional
    public void createLowBalanceNotification(UUID userId, String accountName, BigDecimal balance, BigDecimal threshold) {
        String title = "Low Balance: " + accountName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "LOW_BALANCE", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "%s has dropped to ₹%.0f, at or below your ₹%.0f alert threshold.",
            accountName, balance, threshold);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("LOW_BALANCE")
                .title(title)
                .message(message)
                .build());
    }

    @Override @Transactional
    public void createSpendAnomalyNotification(UUID userId, String categoryName, BigDecimal amount, BigDecimal average) {
        String title = "Unusual Spend: " + categoryName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "SPEND_ANOMALY", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "A %s expense of ₹%.0f is well above your usual ₹%.0f for this category — check it's expected.",
            categoryName, amount, average);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("SPEND_ANOMALY")
                .title(title)
                .message(message)
                .build());
    }

    @Override @Transactional
    public void createDebtDueNotification(UUID userId, String contactName, BigDecimal amount, LocalDate dueDate, String debtType) {
        String title = "Debt Due: " + contactName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "DEBT_DUE", title, startOfDay);
        if (alreadySentToday) return;

        boolean isToday = dueDate.isEqual(LocalDate.now());
        String verb = "LENT".equals(debtType) ? "owes you" : "you owe";
        String message = isToday
            ? String.format("%s ₹%.0f — %s is due today.", contactName, amount, verb)
            : String.format("%s ₹%.0f — %s is due on %s.", contactName, amount, verb, dueDate);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("DEBT_DUE")
                .title(title)
                .message(message)
                .build());
    }

    @Override @Transactional
    public void createEmiUpcomingNotification(UUID userId, String loanName, BigDecimal amount, LocalDate dueDate) {
        String title = "EMI Due Soon: " + loanName;
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        boolean alreadySentToday = notificationRepository
                .existsByUserIdAndTypeAndTitleAndCreatedAtAfter(userId, "LOAN_EMI_UPCOMING", title, startOfDay);
        if (alreadySentToday) return;

        String message = String.format(
            "Your %s EMI of ₹%.0f will be auto-paid on %s.", loanName, amount, dueDate);

        notificationRepository.save(Notification.builder()
                .userId(userId)
                .type("LOAN_EMI_UPCOMING")
                .title(title)
                .message(message)
                .build());
    }
}
