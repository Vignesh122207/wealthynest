package com.wealthynest.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.util.Base64;

/**
 * Push (FCM) is opt-in infrastructure: {@code FCM_SERVICE_ACCOUNT_JSON} is blank in local/dev/CI
 * by default, so no {@link FirebaseMessaging} bean is registered and
 * {@code FcmPushNotificationSender} falls back to a no-op — same fail-closed-when-unset treatment
 * as {@code GoogleAuthConfig}'s native client id, so the app still starts cleanly without a
 * Firebase project configured.
 */
@Slf4j
@Configuration
public class FirebaseConfig {

    @Bean
    public FirebaseMessaging firebaseMessaging(@Value("${wealthynest.fcm.service-account-json:}") String serviceAccountJsonBase64) {
        if (serviceAccountJsonBase64.isBlank()) {
            log.warn("FCM_SERVICE_ACCOUNT_JSON not set — push notifications are disabled");
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(serviceAccountJsonBase64);
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(new ByteArrayInputStream(decoded)))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty()
                    ? FirebaseApp.initializeApp(options)
                    : FirebaseApp.getInstance();
            return FirebaseMessaging.getInstance(app);
        } catch (Exception e) {
            log.error("Failed to initialize Firebase — push notifications are disabled", e);
            return null;
        }
    }
}
