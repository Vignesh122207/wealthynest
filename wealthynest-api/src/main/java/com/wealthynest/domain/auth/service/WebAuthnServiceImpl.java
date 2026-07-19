package com.wealthynest.domain.auth.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.config.WebAuthnConfig;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.dto.response.PasskeyResponse;
import com.wealthynest.domain.auth.entity.WebAuthnCredential;
import com.wealthynest.domain.auth.repository.WebAuthnCredentialRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.converter.util.ObjectConverter;
import com.webauthn4j.credential.CredentialRecord;
import com.webauthn4j.credential.CredentialRecordImpl;
import com.webauthn4j.data.*;
import com.webauthn4j.data.attestation.authenticator.AAGUID;
import com.webauthn4j.data.attestation.authenticator.AttestedCredentialData;
import com.webauthn4j.data.attestation.authenticator.COSEKey;
import com.webauthn4j.data.attestation.statement.COSEAlgorithmIdentifier;
import com.webauthn4j.data.attestation.statement.NoneAttestationStatement;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.data.extension.authenticator.AuthenticationExtensionsAuthenticatorOutputs;
import com.webauthn4j.data.extension.authenticator.RegistrationExtensionAuthenticatorOutput;
import com.webauthn4j.server.ServerProperty;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * WebAuthn (passkey) registration and login ceremonies. Built directly against webauthn4j-core
 * 0.29.1.RELEASE's verified API (not webauthn4j-spring-security), so SecurityConfig/
 * JwtAuthenticationFilter stay untouched — this is a new authenticated-adjacent surface, not a
 * change to how existing sessions are validated.
 *
 * Registration/login options are exchanged as generic JSON (Map) so the frontend can hand the
 * options straight to the browser's native PublicKeyCredential.parseCreationOptionsFromJSON /
 * parseRequestOptionsFromJSON, and send back exactly what credential.toJSON() produces.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebAuthnServiceImpl implements WebAuthnService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    private static final long TIMEOUT_MS = 300_000L;

    private final WebAuthnCredentialRepository credentialRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final WebAuthnManager webAuthnManager;
    private final ObjectConverter objectConverter;
    private final WebAuthnConfig webAuthnConfig;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper springObjectMapper;

    private static String regChallengeKey(UUID userId) { return "webauthn-reg-challenge:" + userId; }
    private static String loginChallengeKey(String email) { return "webauthn-login-challenge:" + email; }

    @Override
    public Map<String, Object> getRegistrationOptions(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        byte[] challengeBytes = new byte[32];
        SECURE_RANDOM.nextBytes(challengeBytes);
        redisTemplate.opsForValue().set(regChallengeKey(userId),
                Base64.getEncoder().encodeToString(challengeBytes), CHALLENGE_TTL);

        List<PublicKeyCredentialDescriptor> excludeCredentials = credentialRepository.findByUserId(userId).stream()
                .map(c -> new PublicKeyCredentialDescriptor(PublicKeyCredentialType.PUBLIC_KEY, c.getCredentialId(), null))
                .toList();

        PublicKeyCredentialCreationOptions options = new PublicKeyCredentialCreationOptions(
                new PublicKeyCredentialRpEntity(webAuthnConfig.getRpId(), webAuthnConfig.getRpName()),
                new PublicKeyCredentialUserEntity(userId.toString().getBytes(StandardCharsets.UTF_8), user.getEmail(), user.getFullName()),
                new DefaultChallenge(challengeBytes),
                List.of(
                        new PublicKeyCredentialParameters(PublicKeyCredentialType.PUBLIC_KEY, COSEAlgorithmIdentifier.ES256),
                        new PublicKeyCredentialParameters(PublicKeyCredentialType.PUBLIC_KEY, COSEAlgorithmIdentifier.RS256)),
                TIMEOUT_MS,
                excludeCredentials,
                new AuthenticatorSelectionCriteria(null, ResidentKeyRequirement.PREFERRED, UserVerificationRequirement.PREFERRED),
                AttestationConveyancePreference.NONE,
                null
        );
        return toMap(options);
    }

    @Override
    @Transactional
    public void verifyRegistration(UUID userId, Map<String, Object> credential, String nickname) {
        String challengeB64 = redisTemplate.opsForValue().get(regChallengeKey(userId));
        if (challengeB64 == null) {
            throw new BusinessException("Registration expired — please try adding the passkey again.", HttpStatus.BAD_REQUEST);
        }
        redisTemplate.delete(regChallengeKey(userId));

        ServerProperty serverProperty = new ServerProperty(
                new Origin(webAuthnConfig.getOrigin()), webAuthnConfig.getRpId(),
                new DefaultChallenge(Base64.getDecoder().decode(challengeB64)));
        RegistrationParameters params = new RegistrationParameters(
                serverProperty,
                List.of(new PublicKeyCredentialParameters(PublicKeyCredentialType.PUBLIC_KEY, COSEAlgorithmIdentifier.ES256),
                        new PublicKeyCredentialParameters(PublicKeyCredentialType.PUBLIC_KEY, COSEAlgorithmIdentifier.RS256)),
                false, true);

        RegistrationData registrationData;
        try {
            registrationData = webAuthnManager.verifyRegistrationResponseJSON(writeJson(credential), params);
        } catch (Exception e) {
            log.warn("Passkey registration verification failed for user {}: {}", userId, e.getMessage());
            throw new BusinessException("Couldn't verify that passkey. Please try again.", HttpStatus.BAD_REQUEST);
        }

        AttestedCredentialData attestedCredentialData = registrationData.getAttestationObject()
                .getAuthenticatorData().getAttestedCredentialData();
        if (attestedCredentialData == null) {
            throw new BusinessException("Couldn't verify that passkey. Please try again.", HttpStatus.BAD_REQUEST);
        }
        long signCount = registrationData.getAttestationObject().getAuthenticatorData().getSignCount();
        byte[] credentialId = attestedCredentialData.getCredentialId();

        if (credentialRepository.findByCredentialId(credentialId).isPresent()) {
            throw new BusinessException("This passkey is already registered.", HttpStatus.CONFLICT);
        }

        String transports = registrationData.getTransports() == null ? null
                : String.join(",", registrationData.getTransports().stream().map(Object::toString).toList());

        credentialRepository.save(WebAuthnCredential.builder()
                .userId(userId)
                .credentialId(credentialId)
                .aaguid(attestedCredentialData.getAaguid().getBytes())
                .publicKeyCose(objectConverter.getCborConverter().writeValueAsBytes(attestedCredentialData.getCOSEKey()))
                .signCount(signCount)
                .transports(transports)
                .nickname(nickname != null && !nickname.isBlank() ? nickname : "Passkey")
                .build());
        log.info("Passkey registered for user {}", userId);
    }

    @Override
    public List<PasskeyResponse> listPasskeys(UUID userId) {
        return credentialRepository.findByUserId(userId).stream()
                .map(c -> PasskeyResponse.builder()
                        .id(c.getId()).nickname(c.getNickname())
                        .createdAt(c.getCreatedAt()).lastUsedAt(c.getLastUsedAt())
                        .build())
                .toList();
    }

    @Override
    @Transactional
    public void deletePasskey(UUID userId, UUID passkeyId) {
        WebAuthnCredential credential = credentialRepository.findByIdAndUserId(passkeyId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Passkey", "id", passkeyId));
        credentialRepository.delete(credential);
    }

    @Override
    public Map<String, Object> getAuthenticationOptions(String email) {
        String normalizedEmail = email.toLowerCase();
        // Deliberately never distinguishes "no such account" from "account has no passkeys" via
        // status code or message — either would let a caller enumerate registered emails, the same
        // enumeration AuthServiceImpl.forgotPassword()/resendVerification() already guard against.
        // A nonexistent (or passkey-less) account just gets an empty allowCredentials list, so the
        // browser reports "no passkey available" the same way it would for a real account with none.
        Optional<User> user = userRepository.findByEmail(normalizedEmail);
        List<WebAuthnCredential> credentials = user
                .map(u -> credentialRepository.findByUserId(u.getId()))
                .orElseGet(List::of);

        byte[] challengeBytes = new byte[32];
        SECURE_RANDOM.nextBytes(challengeBytes);
        // Only store a verifiable challenge when there's something real to authenticate against —
        // otherwise verifyAuthentication() naturally falls through to its existing generic
        // "Passkey sign-in expired" error (challenge lookup miss) without a separate throw here.
        if (!credentials.isEmpty()) {
            redisTemplate.opsForValue().set(loginChallengeKey(normalizedEmail),
                    Base64.getEncoder().encodeToString(challengeBytes), CHALLENGE_TTL);
        }

        List<PublicKeyCredentialDescriptor> allowCredentials = credentials.stream()
                .map(c -> new PublicKeyCredentialDescriptor(PublicKeyCredentialType.PUBLIC_KEY, c.getCredentialId(), null))
                .toList();

        PublicKeyCredentialRequestOptions options = new PublicKeyCredentialRequestOptions(
                new DefaultChallenge(challengeBytes),
                TIMEOUT_MS,
                webAuthnConfig.getRpId(),
                allowCredentials,
                UserVerificationRequirement.PREFERRED,
                null
        );
        return toMap(options);
    }

    @Override
    @Transactional
    public AuthResponse verifyAuthentication(String email, Map<String, Object> credential, boolean rememberMe,
                                              String ipAddress, String userAgent) {
        String normalizedEmail = email.toLowerCase();
        String challengeB64 = redisTemplate.opsForValue().get(loginChallengeKey(normalizedEmail));
        if (challengeB64 == null) {
            throw new BusinessException("Passkey sign-in expired — please try again.", HttpStatus.UNAUTHORIZED);
        }

        String credentialJson = writeJson(credential);
        AuthenticationData parsed;
        try {
            parsed = webAuthnManager.parseAuthenticationResponseJSON(credentialJson);
        } catch (Exception e) {
            throw new BusinessException("Couldn't read that passkey response.", HttpStatus.BAD_REQUEST);
        }

        WebAuthnCredential stored = credentialRepository.findByCredentialId(parsed.getCredentialId())
                .orElseThrow(() -> new BusinessException("This passkey isn't registered.", HttpStatus.UNAUTHORIZED));
        if (!stored.getUserId().equals(userRepository.findByEmail(normalizedEmail).map(User::getId).orElse(null))) {
            throw new AccessDeniedException("Passkey does not belong to this account");
        }

        redisTemplate.delete(loginChallengeKey(normalizedEmail));

        ServerProperty serverProperty = new ServerProperty(
                new Origin(webAuthnConfig.getOrigin()), webAuthnConfig.getRpId(),
                new DefaultChallenge(Base64.getDecoder().decode(challengeB64)));
        CredentialRecord credentialRecord = toCredentialRecord(stored);
        AuthenticationParameters params = new AuthenticationParameters(
                serverProperty, credentialRecord, null, false, true);

        AuthenticationData authenticationData;
        try {
            authenticationData = webAuthnManager.verify(parsed, params);
        } catch (Exception e) {
            log.warn("Passkey login verification failed for {}: {}", normalizedEmail, e.getMessage());
            throw new BusinessException("Couldn't verify that passkey.", HttpStatus.UNAUTHORIZED);
        }

        stored.setSignCount(authenticationData.getAuthenticatorData().getSignCount());
        stored.setLastUsedAt(Instant.now());
        credentialRepository.save(stored);

        return authService.issueTokensForVerifiedUser(stored.getUserId(), rememberMe);
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private CredentialRecord toCredentialRecord(WebAuthnCredential stored) {
        COSEKey coseKey = objectConverter.getCborConverter().readValue(stored.getPublicKeyCose(), COSEKey.class);
        AttestedCredentialData attestedCredentialData = new AttestedCredentialData(
                new AAGUID(stored.getAaguid()), stored.getCredentialId(), coseKey);
        return new CredentialRecordImpl(
                new NoneAttestationStatement(),
                null, null, null,
                stored.getSignCount(),
                attestedCredentialData,
                new AuthenticationExtensionsAuthenticatorOutputs<RegistrationExtensionAuthenticatorOutput>(),
                null, null, null);
    }

    private Map<String, Object> toMap(Object webAuthnObject) {
        String json = objectConverter.getJsonConverter().writeValueAsString(webAuthnObject);
        try {
            return springObjectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Failed to convert WebAuthn options to JSON map", e);
        }
    }

    private String writeJson(Map<String, Object> value) {
        try {
            return springObjectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize WebAuthn credential payload", e);
        }
    }
}
