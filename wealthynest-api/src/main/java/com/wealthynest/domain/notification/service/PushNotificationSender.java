package com.wealthynest.domain.notification.service;

import java.util.UUID;

/** Seam over the real FCM call so {@code NotificationServiceImplTest} can mock delivery without
 * touching the Firebase Admin SDK. */
public interface PushNotificationSender {
    void send(UUID userId, String title, String message);
}
