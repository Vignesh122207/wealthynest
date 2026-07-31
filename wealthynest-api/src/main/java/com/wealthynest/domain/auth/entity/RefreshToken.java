package com.wealthynest.domain.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RefreshToken {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean revoked = false;

    /** Set only by refresh()'s own rotation, so reuse-detection there can tell a benign multi-tab
     * race apart from real theft — see V54's own migration comment. Null for every other
     * revocation path (logout, password reset, explicit session revoke). */
    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "remember_me", nullable = false)
    @Builder.Default
    private boolean rememberMe = true;

    /** Captured at mint time (login/refresh/pin-login/passkey/Google) and re-set on every
     * rotation, so the current row always reflects the device's most recent activity — this is
     * what powers the "active sessions" list in Security settings (AuthService#listSessions). */
    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "created_at", updatable = false, nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
