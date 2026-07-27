package com.wealthynest.domain.notification.service;

import com.google.firebase.messaging.*;
import com.wealthynest.domain.notification.entity.DeviceToken;
import com.wealthynest.domain.notification.repository.DeviceTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FcmPushNotificationSender implements PushNotificationSender {
    private final Optional<FirebaseMessaging> firebaseMessaging;
    private final DeviceTokenRepository deviceTokenRepository;

    @Override
    @Transactional
    public void send(UUID userId, String title, String message) {
        if (firebaseMessaging.isEmpty()) return;
        List<DeviceToken> tokens = deviceTokenRepository.findByUserId(userId);
        if (tokens.isEmpty()) return;

        MulticastMessage multicastMessage = MulticastMessage.builder()
                .addAllTokens(tokens.stream().map(DeviceToken::getToken).toList())
                .setNotification(Notification.builder().setTitle(title).setBody(message).build())
                .build();

        try {
            BatchResponse response = firebaseMessaging.get().sendEachForMulticast(multicastMessage);
            List<SendResponse> responses = response.getResponses();
            for (int i = 0; i < responses.size(); i++) {
                SendResponse sendResponse = responses.get(i);
                if (sendResponse.isSuccessful()) continue;
                MessagingErrorCode errorCode = sendResponse.getException() != null
                        ? sendResponse.getException().getMessagingErrorCode() : null;
                if (errorCode == MessagingErrorCode.UNREGISTERED || errorCode == MessagingErrorCode.INVALID_ARGUMENT) {
                    deviceTokenRepository.deleteByToken(tokens.get(i).getToken());
                }
            }
        } catch (FirebaseMessagingException e) {
            log.error("Push send failed for user {}: {}", userId, e.getMessage());
        }
    }
}
