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
    /** Earliest login for this session's lineage — distinct from createdAt above, which is really
     * "last rotated"/"last active" (the current active row's own timestamp). Lets the Security
     * settings list tell two same-browser sessions apart instead of showing identical rows. */
    private Instant firstSeenAt;
    private Instant expiresAt;
    /** True for the row backing whichever refresh token the caller's own device presented
     * alongside the list request — see AuthService#listSessions. */
    private boolean current;
}
