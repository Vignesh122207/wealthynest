package com.wealthynest.common.security;

import com.wealthynest.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {
    private final JwtProperties jwtProperties;

    public String generateAccessToken(UUID userId, String email, String role) {
        return buildToken(Map.of("role", role, "type", "ACCESS", "uid", userId.toString()), email, jwtProperties.getAccessTokenExpiryMs());
    }
    /** {@code expiryMs} is caller-supplied (not always {@link JwtProperties#getRefreshTokenExpiryMs()})
     * so a non-"remember me" session's token actually expires in as many milliseconds as its backing
     * RefreshToken DB row does, instead of always claiming the full 30-day window internally while
     * the real enforcement point (the DB row) silently uses a shorter one. */
    public String generateRefreshToken(UUID userId, String email, long expiryMs) {
        return buildToken(Map.of("type", "REFRESH", "uid", userId.toString()), email, expiryMs);
    }
    public Claims extractAllClaims(String token) {
        return Jwts.parser().verifyWith(getSigningKey()).build().parseSignedClaims(token).getPayload();
    }
    public String extractSubject(String token) { return extractAllClaims(token).getSubject(); }

    public boolean isTokenValid(String token) {
        try {
            return !extractAllClaims(token).getExpiration().before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }
    public boolean isAccessToken(String token)  { return "ACCESS".equals(extractAllClaims(token).get("type", String.class)); }

    /**
     * Parses and signature-verifies the token exactly once, returning its claims — or empty if
     * malformed, expired, or otherwise invalid. Callers that need multiple facts about a token
     * (subject, type, id, expiry) should use this instead of chaining isTokenValid/isAccessToken/
     * extractSubject/extractAllClaims, each of which independently re-parses and re-verifies.
     */
    public Optional<Claims> parseValidClaims(String token) {
        try {
            Claims claims = extractAllClaims(token);
            if (claims.getExpiration().before(new Date())) return Optional.empty();
            return Optional.of(claims);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Invalid JWT token: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // "jti" must be unique per token, not per user — two tokens minted for the same user within
    // the same second (iat/exp truncate to second precision) would otherwise be byte-identical
    // and collide on refresh_tokens' unique token_hash. The user id itself travels in the "uid"
    // claim instead (see JwtAuthenticationFilter).
    private String buildToken(Map<String, Object> claims, String subject, long expiryMs) {
        Date now = new Date();
        return Jwts.builder().claims(claims).subject(subject).id(UUID.randomUUID().toString())
                .issuedAt(now).expiration(new Date(now.getTime() + expiryMs))
                .signWith(getSigningKey()).compact();
    }
    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8));
    }
}
