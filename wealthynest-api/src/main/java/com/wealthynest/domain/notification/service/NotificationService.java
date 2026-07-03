package com.wealthynest.domain.notification.service;

import com.wealthynest.domain.notification.dto.response.NotificationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.math.BigDecimal;
import java.util.UUID;

public interface NotificationService {
    Page<NotificationResponse> getNotifications(UUID userId, Pageable pageable);
    long getUnreadCount(UUID userId);
    void markAllRead(UUID userId);
    void createBudgetBreachNotification(UUID userId, String categoryName, BigDecimal spent, BigDecimal budget, double pct);
}
