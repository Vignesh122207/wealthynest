package com.wealthynest.common.security;

import com.wealthynest.config.JwtProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * TokenRevocationService fails open on Redis errors by design — an outage in the revocation
 * store must not block every authenticated request (see the class javadoc + isRevoked's catch
 * block). This is a deliberate, reviewed trade-off (session 2026-07-19 security review), not a
 * gap — these tests lock in that exact behavior rather than "fixing" it into fail-closed.
 */
@ExtendWith(MockitoExtension.class)
class TokenRevocationServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private JwtProperties jwtProperties;

    private TokenRevocationService service;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new TokenRevocationService(redisTemplate, jwtProperties);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    @DisplayName("revokeAllTokensFor stores the revocation instant with a TTL matching the access-token expiry")
    void revokeAllTokensFor_setsKeyWithExpiryTtl() {
        when(jwtProperties.getAccessTokenExpiryMs()).thenReturn(900_000L);

        service.revokeAllTokensFor(userId);

        verify(valueOperations).set(eq("token-revoked:" + userId), anyString(), eq(Duration.ofSeconds(900)));
    }

    @Test
    @DisplayName("revokeAllTokensFor clamps a sub-second expiry to a minimum 1-second TTL")
    void revokeAllTokensFor_clampsSubSecondExpiryToOneSecond() {
        when(jwtProperties.getAccessTokenExpiryMs()).thenReturn(500L);

        service.revokeAllTokensFor(userId);

        verify(valueOperations).set(eq("token-revoked:" + userId), anyString(), eq(Duration.ofSeconds(1)));
    }

    @Test
    @DisplayName("revokeAllTokensFor swallows a Redis error rather than propagating it")
    void revokeAllTokensFor_redisError_swallowed() {
        when(jwtProperties.getAccessTokenExpiryMs()).thenReturn(900_000L);
        doThrow(new RuntimeException("Redis down")).when(valueOperations).set(anyString(), anyString(), any(Duration.class));

        org.assertj.core.api.Assertions.assertThatCode(() -> service.revokeAllTokensFor(userId))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("isRevoked -> false when no revocation has been recorded for the user")
    void isRevoked_noRecord_returnsFalse() {
        when(valueOperations.get("token-revoked:" + userId)).thenReturn(null);

        assertThat(service.isRevoked(userId, new Date())).isFalse();
    }

    @Test
    @DisplayName("isRevoked -> false when issuedAt is null")
    void isRevoked_nullIssuedAt_returnsFalse() {
        when(valueOperations.get("token-revoked:" + userId)).thenReturn(
                Long.toString(Instant.now().toEpochMilli()));

        assertThat(service.isRevoked(userId, null)).isFalse();
    }

    @Test
    @DisplayName("isRevoked -> true when the token was issued at or before the recorded revocation instant")
    void isRevoked_issuedBeforeRevocation_returnsTrue() {
        long revokedAtMillis = Instant.now().toEpochMilli();
        when(valueOperations.get("token-revoked:" + userId)).thenReturn(Long.toString(revokedAtMillis));

        Date issuedAt = new Date(revokedAtMillis - 5000);
        assertThat(service.isRevoked(userId, issuedAt)).isTrue();
    }

    @Test
    @DisplayName("isRevoked -> false when the token was issued after the recorded revocation instant")
    void isRevoked_issuedAfterRevocation_returnsFalse() {
        long revokedAtMillis = Instant.now().toEpochMilli();
        when(valueOperations.get("token-revoked:" + userId)).thenReturn(Long.toString(revokedAtMillis));

        Date issuedAt = new Date(revokedAtMillis + 5000);
        assertThat(service.isRevoked(userId, issuedAt)).isFalse();
    }

    @Test
    @DisplayName("isRevoked fails open (returns false) when Redis is unreachable — deliberate, reviewed trade-off")
    void isRevoked_redisError_failsOpen() {
        when(valueOperations.get(anyString())).thenThrow(new RuntimeException("Redis down"));

        assertThat(service.isRevoked(userId, new Date())).isFalse();
    }
}
