package com.wealthynest.domain.auth.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;
import java.util.UUID;

@Getter @Builder
public class PasskeyResponse {
    private UUID    id;
    private String  nickname;
    private Instant createdAt;
    private Instant lastUsedAt;
}
