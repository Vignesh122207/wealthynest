package com.wealthynest.common.security;

import com.wealthynest.config.JwtProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Closes the gap left by stateless access tokens having no revocation path: a
 * leaked or stolen token otherwise stays valid for its full lifetime even
 * after the account's password is changed. Records, per user, the instant
 * after which any previously-issued access token should be treated as invalid
 * — checked on every authenticated request in {@link JwtAuthenticationFilter}.
 *
 * Deliberately not used for plain logout (which only ends one session) or
 * account deactivation (already covered by {@code UserDetails.isEnabled()}) —
 * only for events that should invalidate every access token in flight, e.g.
 * changing or resetting a password.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenRevocationService {
    private final StringRedisTemplate redisTemplate;
    private final JwtProperties       jwtProperties;

    private static String key(UUID userId) { return "token-revoked:" + userId; }

    public void revokeAllTokensFor(UUID userId) {
        try {
            long ttlSeconds = Math.max(1, jwtProperties.getAccessTokenExpiryMs() / 1000);
            redisTemplate.opsForValue().set(
                    key(userId), Long.toString(Instant.now().toEpochMilli()), Duration.ofSeconds(ttlSeconds));
        } catch (Exception e) {
            log.warn("Failed to record access-token revocation for user {}: {}", userId, e.getMessage());
        }
    }

    public boolean isRevoked(UUID userId, Date issuedAt) {
        try {
            String raw = redisTemplate.opsForValue().get(key(userId));
            if (raw == null || issuedAt == null) return false;
            return issuedAt.getTime() <= Long.parseLong(raw);
        } catch (Exception e) {
            log.warn("Token revocation check failed for user {}, failing open: {}", userId, e.getMessage());
            return false;
        }
    }
}
