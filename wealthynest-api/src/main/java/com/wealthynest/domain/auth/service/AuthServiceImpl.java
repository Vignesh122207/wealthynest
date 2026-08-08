package com.wealthynest.domain.auth.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.security.JwtTokenProvider;
import com.wealthynest.common.security.TokenRevocationService;
import com.wealthynest.config.JwtProperties;
import com.wealthynest.domain.auth.dto.request.*;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.entity.EmailVerificationToken;
import com.wealthynest.domain.auth.entity.PasswordResetToken;
import com.wealthynest.domain.auth.entity.RefreshToken;
import com.wealthynest.domain.auth.repository.EmailVerificationTokenRepository;
import com.wealthynest.domain.auth.repository.PasswordResetTokenRepository;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.auth.repository.WebAuthnCredentialRepository;
import com.wealthynest.domain.admin.entity.SystemSetting;
import com.wealthynest.domain.admin.repository.SystemSettingRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.infra.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.auth.dto.response.SessionResponse;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository                   userRepository;
    private final RefreshTokenRepository           refreshTokenRepository;
    private final PasswordResetTokenRepository     passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordEncoder                  passwordEncoder;
    private final JwtTokenProvider                 jwtTokenProvider;
    private final AuthenticationManager            authenticationManager;
    private final UserMapper                       userMapper;
    private final JwtProperties                    jwtProperties;
    private final EmailService                     emailService;
    private final AuditService                     auditService;
    private final TokenRevocationService           tokenRevocationService;
    private final WebAuthnCredentialRepository     webAuthnCredentialRepository;
    private final GoogleIdTokenValidator            googleIdTokenValidator;
    private final RestClient                        googleOAuthClient; // @Bean("googleOAuthClient") — matched by field name, same as ExternalPriceServiceImpl's RestClient fields
    private final SystemSettingRepository           systemSettingRepository;

    @Value("${wealthynest.mail.frontend-url}")
    private String frontendUrl;

    @Value("${wealthynest.mail.reset-token-expiry-minutes:15}")
    private int resetTokenExpiryMinutes;

    @Value("${wealthynest.google.client-id:}")
    private String googleClientId;

    // Only needed for the web popup-code fallback's server-side exchange (see googleLoginPopup) —
    // the primary web flow (googleLogin) verifies an ID token directly and never touches this.
    @Value("${wealthynest.google.client-secret:}")
    private String googleClientSecret;

    @Value("${wealthynest.google.native.client-id:}")
    private String googleNativeClientId;

    @Value("${wealthynest.google.native.client-secret:}")
    private String googleNativeClientSecret;

    /** Short session TTL when "remember me" is NOT checked (1 day). */
    private static final long SHORT_REFRESH_TTL_MS = 24L * 60 * 60 * 1000;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** Brute-force defense: lock the account after this many consecutive bad passwords. */
    private static final int  MAX_FAILED_LOGIN_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION_MS        = 15L * 60 * 1000;

    // Separate from the password lockout counters above — a wrong PIN on a physically-accessed
    // trusted device is a different threat model than remote password credential stuffing, and
    // conflating the two would let one attack vector lock out the other login path.
    private static final int  MAX_PIN_ATTEMPTS       = 5;
    private static final long PIN_LOCKOUT_DURATION_MS = 15L * 60 * 1000;

    /** Refresh-token reuse-detection grace window — see refresh()'s own comment. Wide enough to
     * absorb an ordinary multi-tab rotation race (two tabs sharing the same refresh cookie both
     * hit a 401 and refresh within moments of each other), narrow enough that a real attacker
     * racing a stolen token this tightly gains nothing beyond what today's reject-only behavior
     * already denies them. */
    private static final long REFRESH_REUSE_GRACE_MS = 10_000;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().toLowerCase();
        // Hashed unconditionally, before the existence check below, so both branches pay the same
        // ~250ms BCrypt cost — otherwise the already-registered branch returns near-instantly
        // (email dispatch is @Async) while the new-account branch always pays that cost, and
        // response latency alone reveals whether an email is registered despite the identical
        // response body, undermining the enumeration protection that body is there for.
        String passwordHash = passwordEncoder.encode(request.getPassword());

        // Same enumeration posture as forgotPassword/resendVerification: the external response
        // shape never reveals whether this email was already registered. An existing owner gets a
        // "someone tried to sign up with your email" notice (with a login/reset link) instead of a
        // verification email; either way the caller sees the same "check your email" outcome.
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            emailService.sendAccountExistsEmail(email, existing.get().getFullName());
            log.info("Registration attempted for an email that's already registered");
            return AuthResponse.builder().accessToken(null).refreshToken(null).expiresIn(0).tokenType("Bearer").build();
        }

        User user = userRepository.save(User.builder()
                .fullName(request.getFullName())
                .email(email)
                .passwordHash(passwordHash)
                .emailVerified(false)
                .build());

        sendVerificationEmail(user);
        log.info("New user registered (pending verification): {}", user.getId());
        // Return null tokens — frontend should redirect to verify-email page
        return AuthResponse.builder()
                .accessToken(null)
                .refreshToken(null)
                .expiresIn(0)
                .tokenType("Bearer")
                // hasPasskeys is always false here, not looked up - this is a User just created
                // by userRepository.save() two lines above, provably too new to have any
                // WebAuthnCredential rows yet.
                .user(userMapper.toResponse(user, false))
                .build();
    }

    @Override
    // registerFailedLogin() below persists the failed-attempt counter/lockout before this method
    // re-throws BadCredentialsException — without noRollbackFor, Spring's default
    // rollback-on-unchecked-exception rule would undo that save along with everything else in
    // this transaction, silently disabling the brute-force lockout.
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public AuthResponse login(LoginRequest request, String ipAddress, String userAgent, String previousRefreshToken) {
        String email = request.getEmail().toLowerCase();

        // Checked explicitly (and first) rather than left to Spring Security's own
        // UserPrincipal.isAccountNonLocked() pre-auth check: that path throws a generic
        // LockedException with no timing info, which GlobalExceptionHandler can only turn into a
        // bare 403 — not enough for the frontend to show a "try again in N minutes" countdown.
        // isAccountNonLocked() stays in place as a defense-in-depth fallback for the race where a
        // lockout lands in the instant between this check and authenticate() below.
        userRepository.findByEmail(email).ifPresent(user -> {
            if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
                throw new BusinessException(
                        "Too many failed attempts. Please try again later.",
                        HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                        Map.of("lockedUntil", DateTimeFormatter.ISO_INSTANT.format(user.getLockedUntil())));
            }
        });

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getPassword()));
        } catch (BadCredentialsException e) {
            registerFailedLogin(email, ipAddress, userAgent);
            throw e;
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (!user.isEmailVerified()) {
            throw new BusinessException(
                "Email not verified. Check your inbox for a verification link.",
                HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED");
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        auditService.log(user.getId(), "LOGIN_SUCCESS", "USER", user.getId(), null, null, ipAddress, userAgent);
        sendNewSignInEmailIfEnabled(user, ipAddress, userAgent);
        revokeIfOwnedByUser(previousRefreshToken, user.getId());
        return buildAuthResponse(user, request.isRememberMe(), ipAddress, userAgent);
    }

    // Tracks consecutive bad passwords per account and locks it out for a cooldown
    // window once the threshold is hit — closes the brute-force gap left by
    // UserPrincipal.isAccountNonLocked() previously always returning true.
    private void registerFailedLogin(String email, String ipAddress, String userAgent) {
        userRepository.findByEmail(email).ifPresent(user -> {
            int attempts = user.getFailedLoginAttempts() + 1;
            if (attempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
                user.setFailedLoginAttempts(0);
                user.setLockedUntil(Instant.now().plusMillis(LOCKOUT_DURATION_MS));
                log.warn("Account locked after {} failed login attempts: {}", MAX_FAILED_LOGIN_ATTEMPTS, user.getId());
                auditService.log(user.getId(), "ACCOUNT_LOCKED", "USER", user.getId(), null, null, ipAddress, userAgent);
            } else {
                user.setFailedLoginAttempts(attempts);
            }
            userRepository.save(user);
            auditService.log(user.getId(), "LOGIN_FAILED", "USER", user.getId(), null, null, ipAddress, userAgent);
        });
    }

    @Override
    @Transactional
    public AuthResponse refresh(String refreshToken, String ipAddress, String userAgent) {
        String tokenHash = hashToken(refreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("Invalid refresh token", HttpStatus.UNAUTHORIZED, "INVALID_TOKEN"));
        if (stored.isRevoked()) {
            // Reused after rotation already moved this session on to a newer token. Presented well
            // after that rotation, there's no ordinary reason this exact, already-superseded token
            // would resurface: treat it as the token having been stolen and used alongside the
            // legitimate device, and revoke the whole session.
            if (stored.getRevokedAt() != null
                    && stored.getRevokedAt().isBefore(Instant.now().minusMillis(REFRESH_REUSE_GRACE_MS))) {
                refreshTokenRepository.revokeAllByUserId(stored.getUserId());
                tokenRevocationService.revokeAllTokensFor(stored.getUserId());
                log.warn("Refresh token reuse detected outside rotation grace window — revoking all sessions for user {}", stored.getUserId());
                auditService.log(stored.getUserId(), "REFRESH_TOKEN_REUSE_DETECTED", "USER", stored.getUserId(), null, null, ipAddress, userAgent);
                throw new BusinessException("Refresh token expired or revoked", HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED");
            }
            // revokedAt is null for every other revocation path (logout, password reset, explicit
            // session revoke) — the user's own deliberate action, which must never be quietly
            // undone by handing back a working session just because it's presented again soon after.
            if (stored.getRevokedAt() == null) {
                throw new BusinessException("Refresh token expired or revoked", HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED");
            }
            // Reused within REFRESH_REUSE_GRACE_MS of its own rotation — this is almost always the
            // benign multi-tab/background-resync race described on that constant (confirmed live:
            // wealthynest-web's DashboardLayout fires its own profile resync on every mount, which
            // 401s-and-refreshes on a cold load same as any other request — a second near-simultaneous
            // navigation or an in-flight request racing a fresh one can each redeem this same,
            // about-to-rotate cookie). Rejecting this one request used to force a real logout for a
            // session that was never actually in danger — this device's *other* request already
            // rotated it forward a moment ago. Can't hand back that exact successor token (only its
            // hash is ever persisted — see hashToken's own comment — so the raw value genuinely
            // doesn't exist to return), so this mints an entirely new, independent session for the
            // same user instead. That leaves one extra valid-but-unused token sitting alongside
            // whichever one the browser's own cookie jar ends up keeping — harmless, since each
            // remains single-use and this device already legitimately holds the account's session
            // either way; it simply expires unused on its own TTL, same as any refresh token nobody
            // ever redeems.
            User user = userRepository.findById(stored.getUserId())
                    .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
            return buildAuthResponse(user, stored.isRememberMe(), ipAddress, userAgent, stored.getSessionId());
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("Refresh token expired or revoked", HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED");
        }
        stored.setRevoked(true);
        stored.setRevokedAt(Instant.now());
        refreshTokenRepository.save(stored);
        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        return buildAuthResponse(user, stored.isRememberMe(), ipAddress, userAgent, stored.getSessionId());
    }

    @Override
    @Transactional
    public void logout(String refreshToken, String ipAddress, String userAgent) {
        String tokenHash = hashToken(refreshToken);
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(t -> {
            // Not just this one row — the grace-window race in refresh() can leave a still-valid
            // sibling row under the same sessionId (see that path's own comment: "harmless... one
            // extra valid-but-unused token"). Harmless while the session is still alive, but
            // revoking only the presented row here left that sibling behind, un-revoked, so
            // listSessions kept showing this session as active — for as long as the sibling's own
            // TTL, up to 30 days for a remembered session — even after a real, explicit logout.
            revokeSessionLineage(t.getUserId(), t.getSessionId());
            auditService.log(t.getUserId(), "LOGOUT", "USER", t.getUserId(), null, null, ipAddress, userAgent);
        });
    }

    // Revokes every row sharing a session's lineage — see sessionId's own comment on RefreshToken
    // for why a session can span more than one row. Shared by every path that means to end a
    // session outright (logout, a fresh login cleaning up this device's previous one), as opposed
    // to an ordinary rotation (refresh/pinLogin), which revokes only the one row being rotated
    // forward and deliberately leaves the rest of the lineage (including any such sibling) alone.
    private void revokeSessionLineage(UUID userId, UUID sessionId) {
        List<RefreshToken> tokens = refreshTokenRepository.findByUserIdAndSessionId(userId, sessionId);
        tokens.forEach(t -> t.setRevoked(true));
        refreshTokenRepository.saveAll(tokens);
    }

    @Override
    @Transactional
    public void verifyEmail(String token, String ipAddress, String userAgent) {
        String tokenHash = hashToken(token);
        EmailVerificationToken evt = emailVerificationTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException(
                        "Invalid or expired verification link.", HttpStatus.BAD_REQUEST, "INVALID_TOKEN"));

        if (evt.isUsed() || evt.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException(
                    "This verification link has expired. Request a new one.", HttpStatus.BAD_REQUEST, "TOKEN_EXPIRED");
        }

        User user = userRepository.findById(evt.getUserId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        // A pending email means this link is confirming an email CHANGE (see changeEmail),
        // not the original signup verification — promote it instead of just flipping the flag.
        if (user.getPendingEmail() != null) {
            String newEmail = user.getPendingEmail();
            if (userRepository.existsByEmail(newEmail)) {
                throw new BusinessException(
                        "That email is now in use by another account. Start the change again with a different address.",
                        HttpStatus.CONFLICT, "EMAIL_EXISTS");
            }
            String previousEmail = user.getEmail();
            user.setEmail(newEmail);
            user.setPendingEmail(null);
            user.setEmailVerified(true);
            userRepository.save(user);

            evt.setUsed(true);
            emailVerificationTokenRepository.save(evt);

            log.info("Email changed for user {}", user.getId());
            auditService.log(user.getId(), "EMAIL_CHANGED", "USER", user.getId(),
                    java.util.Map.of("email", previousEmail), java.util.Map.of("email", newEmail), ipAddress, userAgent);
            return;
        }

        user.setEmailVerified(true);
        userRepository.save(user);

        evt.setUsed(true);
        emailVerificationTokenRepository.save(evt);

        log.info("Email verified for user {}", user.getId());
        auditService.log(user.getId(), "EMAIL_VERIFIED", "USER", user.getId(), null, null, ipAddress, userAgent);
    }

    @Override
    @Transactional
    public void resendVerification(String email) {
        // Silent response to avoid confirming whether an email is registered
        userRepository.findByEmail(email.toLowerCase()).ifPresent(user -> {
            if (!user.isEmailVerified()) {
                sendVerificationEmail(user);
            }
        });
    }

    @Override
    @Transactional
    public void changeEmail(UUID userId, ChangeEmailRequest request, String ipAddress, String userAgent) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("Current password is incorrect", HttpStatus.BAD_REQUEST, "WRONG_PASSWORD");
        }

        String newEmail = request.getNewEmail().toLowerCase().trim();
        if (newEmail.equals(user.getEmail())) {
            throw new BusinessException("That's already your email address.", HttpStatus.BAD_REQUEST);
        }
        if (userRepository.existsByEmail(newEmail)) {
            throw new BusinessException("Email already in use", HttpStatus.CONFLICT, "EMAIL_EXISTS");
        }

        // The current email/emailVerified are untouched — only a click on the link below
        // promotes pendingEmail (see verifyEmail), so nothing about this account's login
        // changes until the new address is actually proven.
        user.setPendingEmail(newEmail);
        userRepository.save(user);

        emailVerificationTokenRepository.deleteAllByUserId(user.getId());
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        String rawToken = HexFormat.of().formatHex(bytes);
        emailVerificationTokenRepository.save(EmailVerificationToken.builder()
                .tokenHash(hashToken(rawToken))
                .userId(user.getId())
                .expiresAt(Instant.now().plusSeconds(24 * 60 * 60L))
                .build());
        String link = frontendUrl + "/verify-email?token=" + rawToken;
        emailService.sendVerificationEmail(newEmail, user.getFullName(), link);

        log.info("Email change requested for user {}", user.getId());
        auditService.log(userId, "EMAIL_CHANGE_REQUESTED", "USER", userId,
                java.util.Map.of("email", user.getEmail()), java.util.Map.of("pendingEmail", newEmail), ipAddress, userAgent);
    }

    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().toLowerCase();
        userRepository.findByEmail(email).ifPresent(user -> {
            passwordResetTokenRepository.deleteByEmail(email);
            byte[] bytes = new byte[32];
            SECURE_RANDOM.nextBytes(bytes);
            String rawToken = HexFormat.of().formatHex(bytes);
            passwordResetTokenRepository.save(PasswordResetToken.builder()
                    .tokenHash(hashToken(rawToken))
                    .email(email)
                    .expiresAt(Instant.now().plusSeconds(resetTokenExpiryMinutes * 60L))
                    .build());
            emailService.sendPasswordResetEmail(email, user.getFullName(),
                    frontendUrl + "/reset-password?token=" + rawToken);
            log.info("Password reset initiated for user {}", user.getId());
        });
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request, String ipAddress, String userAgent) {
        String tokenHash = hashToken(request.getToken());
        PasswordResetToken prt = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException(
                        "Invalid or expired reset link", HttpStatus.BAD_REQUEST, "INVALID_TOKEN"));
        if (prt.isUsed() || prt.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException(
                    "This reset link has expired. Please request a new one.", HttpStatus.BAD_REQUEST, "TOKEN_EXPIRED");
        }
        User user = userRepository.findByEmail(prt.getEmail())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        prt.setUsed(true);
        passwordResetTokenRepository.save(prt);
        refreshTokenRepository.revokeAllByUserId(user.getId());
        tokenRevocationService.revokeAllTokensFor(user.getId());
        log.info("Password reset successful for user {}", user.getId());
        auditService.log(user.getId(), "PASSWORD_RESET", "USER", user.getId(), null, null, ipAddress, userAgent);
    }

    // Deliberately no current-password step-up check on FIRST-TIME setup (pinHash still null) —
    // a conscious product call, not an oversight: whoever already holds this authenticated session
    // can set up PIN unlock directly, since there's no existing protection yet for a backdoor PIN
    // to bypass. Replacing an already-set PIN is the different, more sensitive case: without a
    // password check here, "Forgot your PIN?" (which deliberately skips proving the OLD pin — see
    // PinVerifyModal's own comment) would let anyone holding an already-unlocked device silently
    // swap in their own PIN, same risk disablePin's own step-up guards against, and worse — the
    // account still shows PIN unlock as "ENABLED" throughout, so the real owner has no visible sign
    // anything changed until their own PIN stops working.
    @Override
    @Transactional
    public void enablePin(UUID userId, EnablePinRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        if (user.getPinHash() != null) {
            if (user.getPasswordHash() == null) {
                // Google-only account (never set a local password) with a PIN already configured
                // — passwordEncoder.matches() requires a non-null encoded value, so this has to be
                // its own branch rather than falling into the mismatch case below.
                throw new BusinessException(
                        "Resetting your PIN needs your account password — set one in Settings first.",
                        HttpStatus.BAD_REQUEST);
            }
            String currentPassword = request.getCurrentPassword();
            if (currentPassword == null || currentPassword.isBlank()
                    || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
                throw new BusinessException("Current password is incorrect", HttpStatus.BAD_REQUEST, "WRONG_PASSWORD");
            }
        }
        user.setPinHash(passwordEncoder.encode(request.getPin()));
        user.setPinEnabledAt(Instant.now());
        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        log.info("PIN unlock enabled for user {}", userId);
    }

    // Unlike enablePin, this DOES require proving the current PIN first — turning protection OFF
    // is the more sensitive direction: anyone holding an already-unlocked device for a few seconds
    // could otherwise disable it outright (not just plant a backdoor PIN the way a missing check
    // on enablePin would allow). Shares pinLogin's own attempt counter/lockout fields rather than
    // adding separate ones — it's the same secret being brute-forced either way.
    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public void disablePin(UUID userId, DisablePinRequest request, String ipAddress, String userAgent) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (user.getPinHash() == null) {
            throw new BusinessException("PIN unlock isn't enabled for this account.", HttpStatus.BAD_REQUEST);
        }
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(Instant.now())) {
            throw new BusinessException(
                    "Too many incorrect PIN attempts. Please try again later.",
                    HttpStatus.LOCKED, "PIN_LOCKED",
                    Map.of("lockedUntil", DateTimeFormatter.ISO_INSTANT.format(user.getPinLockedUntil())));
        }
        if (!passwordEncoder.matches(request.getPin(), user.getPinHash())) {
            registerFailedPin(user, ipAddress, userAgent, "PIN_DISABLE_FAILED");
            throw new BusinessException("Incorrect PIN", HttpStatus.UNAUTHORIZED, "INVALID_PIN");
        }

        user.setPinHash(null);
        user.setPinEnabledAt(null);
        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        auditService.log(userId, "PIN_DISABLED", "USER", userId, null, null, ipAddress, userAgent);
        log.info("PIN unlock disabled for user {}", userId);
    }

    /**
     * PIN is a device-local quick re-auth, not a standalone remote credential — it only works
     * alongside a still-valid refresh token from a prior full password login, so guessing a
     * 4-6 digit PIN alone (from a device that never logged in here) gets nowhere.
     */
    @Override
    // Same rollback pitfall as login() above: registerFailedPin() persists the failed-attempt
    // counter/lockout before this method re-throws BusinessException — without noRollbackFor,
    // Spring's default rollback-on-unchecked-exception rule would undo that save, silently
    // disabling the PIN brute-force lockout.
    @Transactional(noRollbackFor = BusinessException.class)
    public AuthResponse pinLogin(PinLoginRequest request, String refreshToken, String ipAddress, String userAgent) {
        String tokenHash = hashToken(refreshToken);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException(
                        "Session expired — please sign in with your password.", HttpStatus.UNAUTHORIZED, "INVALID_TOKEN"));
        if (stored.isRevoked()) {
            // revokedAt null means something other than an ordinary rotation revoked this row
            // (logout, password reset, explicit session revoke) — a deliberate action never to be
            // quietly undone. An old revokedAt (well outside the grace window refresh() polices
            // reuse with — see REFRESH_REUSE_GRACE_MS's own comment) means there's no ordinary
            // reason this exact, already-superseded token would resurface this late; reject same as
            // always rather than extend refresh()'s own revoke-everything escalation here too.
            if (stored.getRevokedAt() == null
                    || stored.getRevokedAt().isBefore(Instant.now().minusMillis(REFRESH_REUSE_GRACE_MS))) {
                throw new BusinessException(
                        "Session expired — please sign in with your password.", HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED");
            }
            // Reused within the grace window of its own rotation — the same benign multi-tab/
            // background-resync race refresh() tolerates (see its own comment for the full
            // reasoning: DashboardLayout's profile resync 401s-and-refreshes on every cold load,
            // including one racing this exact PIN unlock for the same cookie). This device's
            // identity is still known from the row itself even though it's already superseded —
            // fall through and verify the PIN as normal instead of forcing "session expired" for a
            // race the user never caused (confirmed live via app-lock.spec.ts's reload-while-locked
            // test, which reproduced this exact failure 3/3 times before this fix).
        } else if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException(
                    "Session expired — please sign in with your password.", HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED");
        }
        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (user.getPinHash() == null) {
            throw new BusinessException("PIN unlock isn't enabled for this account.", HttpStatus.BAD_REQUEST);
        }
        if (user.getPinLockedUntil() != null && user.getPinLockedUntil().isAfter(Instant.now())) {
            throw new BusinessException(
                    "Too many incorrect PIN attempts. Please sign in with your password.",
                    HttpStatus.LOCKED, "PIN_LOCKED",
                    Map.of("lockedUntil", DateTimeFormatter.ISO_INSTANT.format(user.getPinLockedUntil())));
        }
        if (!passwordEncoder.matches(request.getPin(), user.getPinHash())) {
            registerFailedPin(user, ipAddress, userAgent, "PIN_LOGIN_FAILED");
            throw new BusinessException("Incorrect PIN", HttpStatus.UNAUTHORIZED, "INVALID_PIN");
        }

        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        // Rotate the refresh token, same as a normal /refresh — the one just used shouldn't
        // remain valid afterward.
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        auditService.log(user.getId(), "PIN_LOGIN_SUCCESS", "USER", user.getId(), null, null, ipAddress, userAgent);
        return buildAuthResponse(user, stored.isRememberMe(), ipAddress, userAgent, stored.getSessionId());
    }

    // failedAction distinguishes which flow the failure came from (login vs disable-verification)
    // in the audit trail — both draw from and feed the same pinFailedAttempts/pinLockedUntil state
    // on User, since it's the same PIN being brute-forced either way.
    private void registerFailedPin(User user, String ipAddress, String userAgent, String failedAction) {
        int attempts = user.getPinFailedAttempts() + 1;
        if (attempts >= MAX_PIN_ATTEMPTS) {
            user.setPinFailedAttempts(0);
            user.setPinLockedUntil(Instant.now().plusMillis(PIN_LOCKOUT_DURATION_MS));
            log.warn("PIN locked after {} failed attempts: {}", MAX_PIN_ATTEMPTS, user.getId());
            auditService.log(user.getId(), "PIN_LOCKED", "USER", user.getId(), null, null, ipAddress, userAgent);
        } else {
            user.setPinFailedAttempts(attempts);
        }
        userRepository.save(user);
        auditService.log(user.getId(), failedAction, "USER", user.getId(), null, null, ipAddress, userAgent);
    }

    @Override
    @Transactional
    public AuthResponse issueTokensForVerifiedUser(UUID userId, boolean rememberMe, String ipAddress, String userAgent, String previousRefreshToken) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        revokeIfOwnedByUser(previousRefreshToken, userId);
        return buildAuthResponse(user, rememberMe, ipAddress, userAgent);
    }

    // Best-effort device-session rotation for every login path (password, Google, passkey) that
    // doesn't already carry a refresh token of its own through the ceremony to rotate in place the
    // way pinLogin/refresh's token input does — the caller passes along whatever refresh token
    // this device already had, if any (its existing cookie, read before the new one overwrites
    // it), so that row gets revoked here instead of quietly accumulating as a duplicate "active
    // session" alongside the new one. Silently no-ops for a blank/unknown/foreign token — this is
    // a cleanup nicety, not a security boundary, so it must never fail the login itself.
    private void revokeIfOwnedByUser(String rawToken, UUID userId) {
        if (rawToken == null || rawToken.isBlank()) return;
        refreshTokenRepository.findByTokenHash(hashToken(rawToken))
                .filter(t -> t.getUserId().equals(userId))
                .ifPresent(t -> revokeSessionLineage(t.getUserId(), t.getSessionId()));
    }

    @Override
    public List<SessionResponse> listSessions(UUID userId, String currentRefreshToken) {
        String currentHash = currentRefreshToken != null && !currentRefreshToken.isBlank()
                ? hashToken(currentRefreshToken) : null;
        List<RefreshToken> tokens = refreshTokenRepository
                .findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(userId, Instant.now());
        // Grouped by sessionId (not row id) — the grace-window race path in refresh() can leave
        // several rows for what's really one device/session (see sessionId's own comment on
        // RefreshToken); collapse those back into a single "Active sessions" entry.
        Map<UUID, List<RefreshToken>> bySession = tokens.stream()
                .collect(Collectors.groupingBy(RefreshToken::getSessionId, LinkedHashMap::new, Collectors.toList()));
        Map<UUID, Instant> firstSeenBySession = refreshTokenRepository.findFirstSeenByUserIdGroupedBySession(userId)
                .stream().collect(Collectors.toMap(row -> (UUID) row[0], row -> (Instant) row[1]));
        return bySession.values().stream()
                .map(group -> {
                    RefreshToken latest = group.get(0); // input is createdAt desc, so this is the newest in the group
                    boolean current = currentHash != null
                            && group.stream().anyMatch(t -> currentHash.equals(t.getTokenHash()));
                    return SessionResponse.builder()
                            .id(latest.getSessionId())
                            .ipAddress(latest.getIpAddress())
                            .userAgent(latest.getUserAgent())
                            .createdAt(latest.getCreatedAt())
                            .firstSeenAt(firstSeenBySession.getOrDefault(latest.getSessionId(), latest.getCreatedAt()))
                            .expiresAt(latest.getExpiresAt())
                            .current(current)
                            .build();
                })
                .toList();
    }

    @Override
    @Transactional
    public void revokeSession(UUID userId, UUID sessionId) {
        if (!refreshTokenRepository.existsByUserIdAndSessionId(userId, sessionId)) {
            throw new ResourceNotFoundException("Session", "id", sessionId);
        }
        revokeSessionLineage(userId, sessionId);
    }

    @Override
    @Transactional
    public void revokeOtherSessions(UUID userId, String currentRefreshToken) {
        refreshTokenRepository.revokeAllByUserIdExcept(userId, hashToken(currentRefreshToken));
    }

    /**
     * Verifies the ID token from Google Identity Services (the GIS button flow — no client
     * secret involved, unlike the redirect authorization-code flow) and signs the user in,
     * registering a new account on first sign-in. An existing LOCAL (password) account with the
     * same email can sign in via Google too — Google has already proven ownership of the email,
     * which is the same trust the password flow relies on.
     */
    @Override
    @Transactional
    public AuthResponse googleLogin(GoogleLoginRequest request, String ipAddress, String userAgent, String previousRefreshToken) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new BusinessException("Google Sign-In isn't configured yet.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        GoogleIdToken.Payload payload = verifyGoogleIdToken(request.getIdToken());
        return signInWithGooglePayload(payload, request.isRememberMe(), ipAddress, userAgent, previousRefreshToken);
    }

    /**
     * Native Android counterpart to googleLogin. The app can only get an authorization code out
     * of the Custom Tab (GenericOAuth2's Android side has no way to attach a client secret to its
     * own token request, and Google requires one for this "Desktop app" client type even with
     * PKCE enabled — confirmed against Google's own OAuth docs, not an assumption). So the
     * exchange happens here, server-side, where googleNativeClientSecret can be held safely and
     * is never shipped in the app.
     */
    @Override
    @Transactional
    public AuthResponse googleLoginNative(GoogleCodeLoginRequest request, String ipAddress, String userAgent, String previousRefreshToken) {
        if (googleNativeClientId == null || googleNativeClientId.isBlank()
                || googleNativeClientSecret == null || googleNativeClientSecret.isBlank()) {
            throw new BusinessException("Google Sign-In isn't configured yet.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        String idTokenString = exchangeGoogleAuthorizationCode(request, googleNativeClientId, googleNativeClientSecret);
        GoogleIdToken.Payload payload = verifyGoogleIdToken(idTokenString);
        return signInWithGooglePayload(payload, request.isRememberMe(), ipAddress, userAgent, previousRefreshToken);
    }

    /**
     * Web counterpart to googleLoginNative — see AuthService's own comment for why this exists:
     * One Tap's silent prompt() is unreliable on a lot of mobile browsers (blocked third-party
     * cookies, no FedCM support, or a post-dismissal cooldown), so WebGoogleSignInButton falls
     * back to GIS's interactive popup code-flow when that happens. Same server-side exchange as
     * the native path, just against the "Web application" OAuth client's own id/secret.
     */
    @Override
    @Transactional
    public AuthResponse googleLoginPopup(GoogleCodeLoginRequest request, String ipAddress, String userAgent, String previousRefreshToken) {
        if (googleClientId == null || googleClientId.isBlank()
                || googleClientSecret == null || googleClientSecret.isBlank()) {
            throw new BusinessException("Google Sign-In isn't configured yet.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        String idTokenString = exchangeGoogleAuthorizationCode(request, googleClientId, googleClientSecret);
        GoogleIdToken.Payload payload = verifyGoogleIdToken(idTokenString);
        return signInWithGooglePayload(payload, request.isRememberMe(), ipAddress, userAgent, previousRefreshToken);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * auditService.log() is {@code @Async} + {@code REQUIRES_NEW} — it runs on its own connection
     * that doesn't wait for the CALLER's transaction to commit. That's harmless when the referenced
     * user already existed before this request (already committed by some earlier transaction), but
     * signInWithGooglePayload's new-account branch audits a user row created in this very
     * transaction — the audit insert's FK can then lose the race against this transaction's own
     * commit, intermittently failing with "not present in table users" (reproduced in prod on
     * brand-new Google signups). Deferring to {@code afterCommit()} closes that race; it's harmless
     * to use unconditionally for the already-existing-user case too, so callers don't need to know
     * which case they're in. {@code isSynchronizationActive()} is false outside a real transaction
     * (e.g. a plain Mockito unit test with no Spring context), where logging immediately is correct.
     */
    private void logAfterCommit(UUID actorId, String action, UUID entityId, String ipAddress, String userAgent) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    auditService.log(actorId, action, "USER", entityId, null, null, ipAddress, userAgent);
                }
            });
        } else {
            auditService.log(actorId, action, "USER", entityId, null, null, ipAddress, userAgent);
        }
    }

    private GoogleIdToken.Payload verifyGoogleIdToken(String idTokenString) {
        try {
            GoogleIdToken.Payload payload = googleIdTokenValidator.verify(idTokenString);
            if (payload == null) {
                throw new BusinessException("Invalid Google sign-in token.", HttpStatus.UNAUTHORIZED);
            }
            return payload;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google ID token verification failed: {}", e.getMessage());
            throw new BusinessException("Invalid Google sign-in token.", HttpStatus.UNAUTHORIZED);
        }
    }

    /** POSTs the authorization code (plus PKCE verifier, when the caller has one) to Google's
     * token endpoint, alongside the client id/secret for whichever OAuth client this request
     * belongs to, and returns the resulting ID token. */
    @SuppressWarnings("unchecked")
    private String exchangeGoogleAuthorizationCode(GoogleCodeLoginRequest request, String clientId, String clientSecret) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("code", request.getCode());
        // The web popup fallback has no PKCE verifier to send — GIS's initCodeClient popup mode
        // never establishes a code_challenge, so there's nothing for Google to check it against.
        if (request.getCodeVerifier() != null && !request.getCodeVerifier().isBlank()) {
            form.add("code_verifier", request.getCodeVerifier());
        }
        form.add("redirect_uri", request.getRedirectUri());
        form.add("grant_type", "authorization_code");

        Map<String, Object> tokenResponse;
        try {
            tokenResponse = googleOAuthClient.post()
                    .uri("/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientException e) {
            log.warn("Google authorization code exchange failed: {}", e.getMessage());
            throw new BusinessException("Google sign-in failed. Please try again.", HttpStatus.UNAUTHORIZED);
        }
        Object idToken = tokenResponse == null ? null : tokenResponse.get("id_token");
        if (!(idToken instanceof String idTokenString) || idTokenString.isBlank()) {
            throw new BusinessException("Google sign-in failed. Please try again.", HttpStatus.UNAUTHORIZED);
        }
        return idTokenString;
    }

    private AuthResponse signInWithGooglePayload(GoogleIdToken.Payload payload, boolean rememberMe, String ipAddress, String userAgent, String previousRefreshToken) {
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new BusinessException("Your Google account's email isn't verified.", HttpStatus.BAD_REQUEST);
        }
        String email = payload.getEmail().toLowerCase();
        String name  = (String) payload.get("name");

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            byte[] randomPassword = new byte[32];
            SECURE_RANDOM.nextBytes(randomPassword);
            User created = userRepository.save(User.builder()
                    .fullName(name != null && !name.isBlank() ? name : email)
                    .email(email)
                    .passwordHash(passwordEncoder.encode(HexFormat.of().formatHex(randomPassword)))
                    .emailVerified(true)
                    .authProvider("GOOGLE")
                    .build());
            log.info("New user registered via Google Sign-In: {}", created.getId());
            logAfterCommit(created.getId(), "GOOGLE_SIGNUP", created.getId(), ipAddress, userAgent);
            return created;
        });

        // Promotes an existing LOCAL (password) account too, not just the new-account branch above
        // — Google already proved ownership of this email (the emailVerified check at the top of
        // this method), which is exactly the same proof the password flow's own verification link
        // exists to establish. Without this, someone who registered with a password, never clicked
        // the verification email, and instead signed in with Google was left able to use the app
        // via Google indefinitely while still carrying emailVerified=false — so the moment they
        // tried their password on the same account, login() rejected them with EMAIL_NOT_VERIFIED
        // despite Google sign-in having worked for them the whole time.
        user.setEmailVerified(true);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        // Also goes through logAfterCommit — for the just-created branch above, `user` is that same
        // uncommitted row (identical race), and deferring costs nothing extra for the ordinary
        // already-committed-user case, so there's no need to special-case which branch ran.
        logAfterCommit(user.getId(), "GOOGLE_LOGIN_SUCCESS", user.getId(), ipAddress, userAgent);
        sendNewSignInEmailIfEnabled(user, ipAddress, userAgent);
        revokeIfOwnedByUser(previousRefreshToken, user.getId());
        return buildAuthResponse(user, rememberMe, ipAddress, userAgent);
    }

    // Gated by both the per-user opt-out (User#loginAlertEnabled, controlled from Settings →
    // Security) and the admin-controlled global kill switch (SystemSetting#loginAlertEmailEnabled)
    // — the admin switch takes precedence, so flipping it off silences the email for every user
    // regardless of their individual preference.
    private void sendNewSignInEmailIfEnabled(User user, String ipAddress, String userAgent) {
        if (!user.isLoginAlertEnabled()) return;
        boolean globallyEnabled = systemSettingRepository.findById(SystemSetting.SINGLETON_ID)
                .map(SystemSetting::isLoginAlertEmailEnabled)
                .orElse(true);
        if (!globallyEnabled) return;
        emailService.sendNewSignInEmail(user.getEmail(), user.getFullName(), ipAddress, userAgent, Instant.now());
    }

    private void sendVerificationEmail(User user) {
        emailVerificationTokenRepository.deleteAllByUserId(user.getId());
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        String rawToken = HexFormat.of().formatHex(bytes);
        emailVerificationTokenRepository.save(EmailVerificationToken.builder()
                .tokenHash(hashToken(rawToken))
                .userId(user.getId())
                .expiresAt(Instant.now().plusSeconds(24 * 60 * 60L))
                .build());
        String link = frontendUrl + "/verify-email?token=" + rawToken;
        emailService.sendVerificationEmail(user.getEmail(), user.getFullName(), link);
    }

    // Fresh login (password/Google/passkey) — starts a brand-new session lineage.
    private AuthResponse buildAuthResponse(User user, boolean rememberMe, String ipAddress, String userAgent) {
        return buildAuthResponse(user, rememberMe, ipAddress, userAgent, UUID.randomUUID());
    }

    // Rotation of an existing session (refresh/PIN unlock, including the grace-window race path)
    // — carries the prior row's sessionId forward so listSessions can group them back into one
    // device entry; see sessionId's own comment on RefreshToken.
    private AuthResponse buildAuthResponse(User user, boolean rememberMe, String ipAddress, String userAgent, UUID sessionId) {
        String accessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        long refreshTtlMs   = rememberMe ? jwtProperties.getRefreshTokenExpiryMs() : SHORT_REFRESH_TTL_MS;
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), refreshTtlMs);
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(user.getId())
                .sessionId(sessionId)
                .tokenHash(hashToken(refreshToken))
                .expiresAt(Instant.now().plusMillis(refreshTtlMs))
                .rememberMe(rememberMe)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .build());
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .refreshTokenExpiresInMs(refreshTtlMs)
                .expiresIn(jwtProperties.getAccessTokenExpiryMs() / 1000)
                .tokenType("Bearer")
                .user(userMapper.toResponse(user, webAuthnCredentialRepository.existsByUserId(user.getId())))
                .build();
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(
                    digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
