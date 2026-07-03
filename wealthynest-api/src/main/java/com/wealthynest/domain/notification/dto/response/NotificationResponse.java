package com.wealthynest.domain.notification.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;
import java.util.UUID;

@Getter @Builder
public class NotificationResponse {
    private UUID    id;
    private String  type;
    private String  title;
    private String  message;
    private boolean read;
    private Instant createdAt;
}
