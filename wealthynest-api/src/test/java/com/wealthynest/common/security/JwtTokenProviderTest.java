package com.wealthynest.common.security;

import com.wealthynest.config.JwtProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private JwtTokenProvider provider;
    private final UUID userId = UUID.randomUUID();
    private final String email = "alice@example.com";

    @BeforeEach
    void setUp() {
        JwtProperties props = new JwtProperties();
        props.setSecret("test-jwt-secret-at-least-32-characters-long");
        props.setAccessTokenExpiryMs(900_000);
        props.setRefreshTokenExpiryMs(2_592_000_000L);
        provider = new JwtTokenProvider(props);
    }

    @Test
    @DisplayName("generateAccessToken -> subject is the email, type claim is ACCESS")
    void generateAccessToken_hasExpectedClaims() {
        String token = provider.generateAccessToken(userId, email, "MEMBER");

        assertThat(provider.extractSubject(token)).isEqualTo(email);
        assertThat(provider.isAccessToken(token)).isTrue();
        assertThat(provider.extractAllClaims(token).get("role", String.class)).isEqualTo("MEMBER");
        assertThat(provider.extractAllClaims(token).get("uid", String.class)).isEqualTo(userId.toString());
    }

    @Test
    @DisplayName("generateRefreshToken -> type claim is REFRESH, not an access token")
    void generateRefreshToken_hasExpectedClaims() {
        String token = provider.generateRefreshToken(userId, email, 60_000);

        assertThat(provider.isAccessToken(token)).isFalse();
        assertThat(provider.extractAllClaims(token).get("type", String.class)).isEqualTo("REFRESH");
    }

    @Test
    @DisplayName("two tokens minted for the same user in the same instant have distinct jti (unique id)")
    void distinctTokens_haveDistinctJti() {
        String token1 = provider.generateAccessToken(userId, email, "MEMBER");
        String token2 = provider.generateAccessToken(userId, email, "MEMBER");

        assertThat(provider.extractAllClaims(token1).getId())
            .isNotEqualTo(provider.extractAllClaims(token2).getId());
    }

    @Test
    @DisplayName("isTokenValid -> true for a freshly minted, unexpired token")
    void isTokenValid_trueForFreshToken() {
        String token = provider.generateAccessToken(userId, email, "MEMBER");
        assertThat(provider.isTokenValid(token)).isTrue();
    }

    @Test
    @DisplayName("isTokenValid -> false for an expired token")
    void isTokenValid_falseForExpiredToken() {
        String token = provider.generateRefreshToken(userId, email, -1000);
        assertThat(provider.isTokenValid(token)).isFalse();
    }

    @Test
    @DisplayName("isTokenValid -> false for a malformed token string, no exception propagates")
    void isTokenValid_falseForMalformedToken() {
        assertThat(provider.isTokenValid("not-a-jwt-at-all")).isFalse();
    }

    @Test
    @DisplayName("isTokenValid -> false for a token signed with a different secret")
    void isTokenValid_falseForWrongSignature() {
        JwtProperties otherProps = new JwtProperties();
        otherProps.setSecret("a-completely-different-secret-of-32-chars-plus");
        otherProps.setAccessTokenExpiryMs(900_000);
        JwtTokenProvider otherProvider = new JwtTokenProvider(otherProps);
        String token = otherProvider.generateAccessToken(userId, email, "MEMBER");

        assertThat(provider.isTokenValid(token)).isFalse();
    }

    @Test
    @DisplayName("parseValidClaims -> present for a valid token, containing the expected subject")
    void parseValidClaims_presentForValidToken() {
        String token = provider.generateAccessToken(userId, email, "MEMBER");
        var claims = provider.parseValidClaims(token);
        assertThat(claims).isPresent();
        assertThat(claims.get().getSubject()).isEqualTo(email);
    }

    @Test
    @DisplayName("parseValidClaims -> empty for an expired token")
    void parseValidClaims_emptyForExpiredToken() {
        String token = provider.generateRefreshToken(userId, email, -1000);
        assertThat(provider.parseValidClaims(token)).isEmpty();
    }

    @Test
    @DisplayName("parseValidClaims -> empty for a malformed token, no exception propagates")
    void parseValidClaims_emptyForMalformedToken() {
        assertThat(provider.parseValidClaims("garbage")).isEmpty();
    }
}
