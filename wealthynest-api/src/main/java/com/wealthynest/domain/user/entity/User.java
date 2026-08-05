package com.wealthynest.domain.user.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class User extends BaseEntity {
    @Column(name = "family_id")
    private UUID familyId;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    /** An email change in progress — set by AuthServiceImpl.changeEmail, cleared and promoted to
     * `email` only once the user clicks the verification link sent to this address. The current
     * `email`/`emailVerified` stay untouched (and the user stays logged in) the whole time, so a
     * change never locks anyone out the way silently overwriting `email` used to. */
    @Column(name = "pending_email", length = 150)
    private String pendingEmail;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private UserRole role = UserRole.MEMBER;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "email_verified", nullable = false)
    @Builder.Default
    private boolean emailVerified = false;

    @Column(name = "failed_login_attempts", nullable = false)
    @Builder.Default
    private int failedLoginAttempts = 0;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    /** Device-local quick re-auth (see AuthServiceImpl.pinLogin) — null means PIN unlock is
     * disabled. Never usable on its own; requires an already-valid refresh token too, so a device
     * that never completed a full password login can't be unlocked by guessing the PIN alone. */
    @Column(name = "pin_hash")
    private String pinHash;

    @Column(name = "pin_enabled_at")
    private Instant pinEnabledAt;

    @Column(name = "pin_failed_attempts", nullable = false)
    @Builder.Default
    private int pinFailedAttempts = 0;

    @Column(name = "pin_locked_until")
    private Instant pinLockedUntil;

    /** LOCAL (password) or GOOGLE — bookkeeping only, doesn't restrict login method: a GOOGLE
     * account can still enable PIN/passkey once signed in, and a LOCAL account isn't blocked
     * from later signing in with Google on the same email. */
    @Column(name = "auth_provider", nullable = false, length = 20)
    @Builder.Default
    private String authProvider = "LOCAL";

    /** Per-user opt-out for the "new sign-in" email sent on every password/Google login (see
     * AuthServiceImpl.login / signInWithGooglePayload). Also gated by the admin-controlled
     * SystemSetting#loginAlertEmailEnabled kill switch, which takes precedence over this. */
    @Column(name = "login_alert_enabled", nullable = false)
    @Builder.Default
    private boolean loginAlertEnabled = true;
}
