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
}
