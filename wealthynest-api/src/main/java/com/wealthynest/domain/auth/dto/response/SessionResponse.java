package com.wealthynest.domain.auth.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;
import java.util.UUID;

@Getter @Builder
public class SessionResponse {
    private UUID    id;
    private String  ipAddress;
    private String  userAgent;
    private Instant createdAt;
    private Instant expiresAt;
    /** True for the row backing whichever refresh token the caller's own device presented
     * alongside the list request — see AuthService#listSessions. */
    private boolean current;
}
