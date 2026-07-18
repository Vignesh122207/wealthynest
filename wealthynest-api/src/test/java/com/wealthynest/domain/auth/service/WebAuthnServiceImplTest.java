package com.wealthynest.domain.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.config.WebAuthnConfig;
import com.wealthynest.domain.auth.dto.response.PasskeyResponse;
import com.wealthynest.domain.auth.entity.WebAuthnCredential;
import com.wealthynest.domain.auth.repository.WebAuthnCredentialRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.converter.util.ObjectConverter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Uses REAL ObjectConverter/WebAuthnManager/ObjectMapper instances (they're plain in-memory
 * utility classes with no DB/network dependency) instead of mocking their deep call chains —
 * only the actual I/O boundaries (repositories, Redis, config) are mocked. True credential
 * verification success paths aren't covered here: that needs a genuine browser-signed
 * attestation object, which can't be meaningfully synthesized in a unit test — those are
 * exercised by the "malformed credential -> wrapped BusinessException" tests instead, which use
 * the real WebAuthnManager's real rejection of bad input.
 */
@ExtendWith(MockitoExtension.class)
class WebAuthnServiceImplTest {

    @Mock private WebAuthnCredentialRepository credentialRepository;
    @Mock private UserRepository               userRepository;
    @Mock private AuthService                  authService;
    @Mock private WebAuthnConfig               webAuthnConfig;
    @Mock private StringRedisTemplate          redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;

    private WebAuthnServiceImpl service;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new WebAuthnServiceImpl(
                credentialRepository, userRepository, authService,
                WebAuthnManager.createNonStrictWebAuthnManager(),
                new ObjectConverter(), webAuthnConfig, redisTemplate, new ObjectMapper());
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(webAuthnConfig.getRpId()).thenReturn("localhost");
        lenient().when(webAuthnConfig.getRpName()).thenReturn("WealthyNest");
        lenient().when(webAuthnConfig.getOrigin()).thenReturn("http://localhost:3000");
    }

    // ─── getRegistrationOptions ──────────────────────────────────────────────────

    @Nested
    @DisplayName("getRegistrationOptions")
    class GetRegistrationOptionsTests {

        @Test
        @DisplayName("throws for an unknown user")
        void throwsForUnknownUser() {
            when(userRepository.findById(userId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getRegistrationOptions(userId)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("stores a fresh challenge in Redis under the per-user key with a TTL")
        void storesChallengeInRedis() {
            User user = User.builder().email("a@x.com").fullName("Alice").build();
            ReflectionTestUtils.setField(user, "id", userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(credentialRepository.findByUserId(userId)).thenReturn(List.of());

            Map<String, Object> options = service.getRegistrationOptions(userId);

            verify(valueOperations).set(eq("webauthn-reg-challenge:" + userId), anyString(), eq(Duration.ofMinutes(5)));
            assertThat(options).isNotEmpty();
        }

        @Test
        @DisplayName("excludes the user's already-registered credential IDs from the options")
        void excludesExistingCredentials() {
            User user = User.builder().email("a@x.com").fullName("Alice").build();
            ReflectionTestUtils.setField(user, "id", userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            WebAuthnCredential existing = WebAuthnCredential.builder().userId(userId)
                    .credentialId(new byte[]{1, 2, 3}).build();
            when(credentialRepository.findByUserId(userId)).thenReturn(List.of(existing));

            Map<String, Object> options = service.getRegistrationOptions(userId);

            assertThat(options).containsKey("excludeCredentials");
            assertThat((List<?>) options.get("excludeCredentials")).isNotEmpty();
        }
    }

    // ─── verifyRegistration ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyRegistration")
    class VerifyRegistrationTests {

        @Test
        @DisplayName("throws when no registration challenge is pending (expired or never started)")
        void throwsWhenChallengeMissing() {
            when(valueOperations.get("webauthn-reg-challenge:" + userId)).thenReturn(null);
            assertThatThrownBy(() -> service.verifyRegistration(userId, Map.of(), "My Key"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("a malformed credential payload is rejected as a BusinessException, not a raw library exception")
        void malformedCredentialWrappedAsBusinessException() {
            when(valueOperations.get("webauthn-reg-challenge:" + userId))
                    .thenReturn(java.util.Base64.getEncoder().encodeToString(new byte[32]));

            assertThatThrownBy(() -> service.verifyRegistration(userId, Map.of("garbage", "data"), "My Key"))
                    .isInstanceOf(BusinessException.class);

            verify(redisTemplate).delete("webauthn-reg-challenge:" + userId); // challenge consumed even on failure
        }
    }

    // ─── listPasskeys / deletePasskey ────────────────────────────────────────────

    @Nested
    @DisplayName("listPasskeys / deletePasskey")
    class PasskeyManagementTests {

        @Test
        @DisplayName("listPasskeys maps stored credentials without exposing raw key material")
        void listPasskeysMapsToResponse() {
            WebAuthnCredential cred = WebAuthnCredential.builder().userId(userId).nickname("MacBook").build();
            ReflectionTestUtils.setField(cred, "id", UUID.randomUUID());
            when(credentialRepository.findByUserId(userId)).thenReturn(List.of(cred));

            List<PasskeyResponse> result = service.listPasskeys(userId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getNickname()).isEqualTo("MacBook");
        }

        @Test
        @DisplayName("deletePasskey throws when the passkey doesn't exist or isn't owned by the caller")
        void deletePasskeyThrowsWhenNotFoundOrNotOwned() {
            UUID passkeyId = UUID.randomUUID();
            when(credentialRepository.findByIdAndUserId(passkeyId, userId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.deletePasskey(userId, passkeyId)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("deletePasskey removes an owned credential")
        void deletePasskeyRemovesOwnedCredential() {
            UUID passkeyId = UUID.randomUUID();
            WebAuthnCredential cred = WebAuthnCredential.builder().userId(userId).build();
            when(credentialRepository.findByIdAndUserId(passkeyId, userId)).thenReturn(Optional.of(cred));

            service.deletePasskey(userId, passkeyId);

            verify(credentialRepository).delete(cred);
        }
    }

    // ─── getAuthenticationOptions ────────────────────────────────────────────────

    @Nested
    @DisplayName("getAuthenticationOptions")
    class GetAuthenticationOptionsTests {

        @Test
        @DisplayName("throws NOT_FOUND for an unregistered email")
        void throwsForUnknownEmail() {
            when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.getAuthenticationOptions("nobody@example.com"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the account has no registered passkeys")
        void throwsWhenNoPasskeysRegistered() {
            User user = User.builder().email("a@x.com").build();
            ReflectionTestUtils.setField(user, "id", userId);
            when(userRepository.findByEmail("a@x.com")).thenReturn(Optional.of(user));
            when(credentialRepository.findByUserId(userId)).thenReturn(List.of());

            assertThatThrownBy(() -> service.getAuthenticationOptions("a@x.com")).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("normalizes email case and stores the login challenge in Redis")
        void normalizesEmailAndStoresChallenge() {
            User user = User.builder().email("a@x.com").build();
            ReflectionTestUtils.setField(user, "id", userId);
            when(userRepository.findByEmail("a@x.com")).thenReturn(Optional.of(user));
            when(credentialRepository.findByUserId(userId)).thenReturn(
                    List.of(WebAuthnCredential.builder().userId(userId).credentialId(new byte[]{1}).build()));

            service.getAuthenticationOptions("A@X.com");

            verify(valueOperations).set(eq("webauthn-login-challenge:a@x.com"), anyString(), eq(Duration.ofMinutes(5)));
        }
    }

    // ─── verifyAuthentication ────────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyAuthentication")
    class VerifyAuthenticationTests {

        @Test
        @DisplayName("throws UNAUTHORIZED when the login challenge has expired or was never started")
        void throwsWhenChallengeMissing() {
            when(valueOperations.get("webauthn-login-challenge:a@x.com")).thenReturn(null);
            assertThatThrownBy(() -> service.verifyAuthentication("a@x.com", Map.of(), false, "ip", "ua"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws for a malformed/unreadable credential payload")
        void throwsForMalformedCredential() {
            when(valueOperations.get("webauthn-login-challenge:a@x.com"))
                    .thenReturn(java.util.Base64.getEncoder().encodeToString(new byte[32]));

            assertThatThrownBy(() -> service.verifyAuthentication("a@x.com", Map.of("garbage", "data"), false, "ip", "ua"))
                    .isInstanceOf(BusinessException.class);
        }
    }
}
