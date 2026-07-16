package com.wealthynest.domain.auth.service;

import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.security.JwtTokenProvider;
import com.wealthynest.common.security.TokenRevocationService;
import com.wealthynest.config.JwtProperties;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.wealthynest.domain.auth.dto.request.ChangeEmailRequest;
import com.wealthynest.domain.auth.dto.request.EnablePinRequest;
import com.wealthynest.domain.auth.dto.request.ForgotPasswordRequest;
import com.wealthynest.domain.auth.dto.request.GoogleLoginRequest;
import com.wealthynest.domain.auth.dto.request.LoginRequest;
import com.wealthynest.domain.auth.dto.request.PinLoginRequest;
import com.wealthynest.domain.auth.dto.request.RefreshTokenRequest;
import com.wealthynest.domain.auth.dto.request.RegisterRequest;
import com.wealthynest.domain.auth.dto.request.ResetPasswordRequest;
import com.wealthynest.domain.auth.dto.response.AuthResponse;
import com.wealthynest.domain.auth.entity.EmailVerificationToken;
import com.wealthynest.domain.auth.entity.PasswordResetToken;
import com.wealthynest.domain.auth.entity.RefreshToken;
import com.wealthynest.domain.auth.repository.EmailVerificationTokenRepository;
import com.wealthynest.domain.auth.repository.PasswordResetTokenRepository;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.infra.email.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

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

    @Value("${wealthynest.mail.frontend-url}")
    private String frontendUrl;

    @Value("${wealthynest.mail.reset-token-expiry-minutes:15}")
    private int resetTokenExpiryMinutes;

    @Value("${wealthynest.google.client-id:}")
    private String googleClientId;

    private volatile GoogleIdTokenVerifier googleIdTokenVerifier;

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

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessException("Email already registered", HttpStatus.CONFLICT, "EMAIL_EXISTS");
        }
        User user = userRepository.save(User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail().toLowerCase())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
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
                .user(userMapper.toResponse(user))
                .build();
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request, String ipAddress, String userAgent) {
        String email = request.getEmail().toLowerCase();
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
        return buildAuthResponse(user, request.isRememberMe());
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
    public AuthResponse refresh(RefreshTokenRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException("Invalid refresh token", HttpStatus.UNAUTHORIZED, "INVALID_TOKEN"));
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new BusinessException("Refresh token expired or revoked", HttpStatus.UNAUTHORIZED, "TOKEN_EXPIRED");
        }
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        return buildAuthResponse(user, stored.isRememberMe());
    }

    @Override
    @Transactional
    public void logout(String refreshToken, String ipAddress, String userAgent) {
        String tokenHash = hashToken(refreshToken);
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(t -> {
            t.setRevoked(true);
            refreshTokenRepository.save(t);
            auditService.log(t.getUserId(), "LOGOUT", "USER", t.getUserId(), null, null, ipAddress, userAgent);
        });
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

    @Override
    @Transactional
    public void enablePin(UUID userId, EnablePinRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new BusinessException("Incorrect password", HttpStatus.BAD_REQUEST);
        }
        user.setPinHash(passwordEncoder.encode(request.getPin()));
        user.setPinEnabledAt(Instant.now());
        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        log.info("PIN unlock enabled for user {}", userId);
    }

    @Override
    @Transactional
    public void disablePin(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setPinHash(null);
        user.setPinEnabledAt(null);
        user.setPinFailedAttempts(0);
        user.setPinLockedUntil(null);
        userRepository.save(user);
        log.info("PIN unlock disabled for user {}", userId);
    }

    /**
     * PIN is a device-local quick re-auth, not a standalone remote credential — it only works
     * alongside a still-valid refresh token from a prior full password login, so guessing a
     * 4-6 digit PIN alone (from a device that never logged in here) gets nowhere.
     */
    @Override
    @Transactional
    public AuthResponse pinLogin(PinLoginRequest request, String ipAddress, String userAgent) {
        String tokenHash = hashToken(request.getRefreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException(
                        "Session expired — please sign in with your password.", HttpStatus.UNAUTHORIZED, "INVALID_TOKEN"));
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
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
                    "Too many incorrect PIN attempts. Please sign in with your password.", HttpStatus.LOCKED);
        }
        if (!passwordEncoder.matches(request.getPin(), user.getPinHash())) {
            registerFailedPin(user, ipAddress, userAgent);
            throw new BusinessException("Incorrect PIN", HttpStatus.UNAUTHORIZED);
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
        return buildAuthResponse(user, stored.isRememberMe());
    }

    private void registerFailedPin(User user, String ipAddress, String userAgent) {
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
        auditService.log(user.getId(), "PIN_LOGIN_FAILED", "USER", user.getId(), null, null, ipAddress, userAgent);
    }

    @Override
    @Transactional
    public AuthResponse issueTokensForVerifiedUser(UUID userId, boolean rememberMe) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        return buildAuthResponse(user, rememberMe);
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
    public AuthResponse googleLogin(GoogleLoginRequest request, String ipAddress, String userAgent) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new BusinessException("Google Sign-In isn't configured yet.", HttpStatus.SERVICE_UNAVAILABLE);
        }
        GoogleIdToken.Payload payload;
        try {
            GoogleIdToken idToken = getGoogleIdTokenVerifier().verify(request.getIdToken());
            if (idToken == null) {
                throw new BusinessException("Invalid Google sign-in token.", HttpStatus.UNAUTHORIZED);
            }
            payload = idToken.getPayload();
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google ID token verification failed: {}", e.getMessage());
            throw new BusinessException("Invalid Google sign-in token.", HttpStatus.UNAUTHORIZED);
        }
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
            auditService.log(created.getId(), "GOOGLE_SIGNUP", "USER", created.getId(), null, null, ipAddress, userAgent);
            return created;
        });

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        auditService.log(user.getId(), "GOOGLE_LOGIN_SUCCESS", "USER", user.getId(), null, null, ipAddress, userAgent);
        return buildAuthResponse(user, request.isRememberMe());
    }

    private GoogleIdTokenVerifier getGoogleIdTokenVerifier() {
        GoogleIdTokenVerifier verifier = googleIdTokenVerifier;
        if (verifier == null) {
            synchronized (this) {
                verifier = googleIdTokenVerifier;
                if (verifier == null) {
                    verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), GsonFactory.getDefaultInstance())
                            .setAudience(java.util.Collections.singletonList(googleClientId))
                            .build();
                    googleIdTokenVerifier = verifier;
                }
            }
        }
        return verifier;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

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

    private AuthResponse buildAuthResponse(User user, boolean rememberMe) {
        String accessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail());
        long refreshTtlMs   = rememberMe ? jwtProperties.getRefreshTokenExpiryMs() : SHORT_REFRESH_TTL_MS;
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(hashToken(refreshToken))
                .expiresAt(Instant.now().plusMillis(refreshTtlMs))
                .rememberMe(rememberMe)
                .build());
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtProperties.getAccessTokenExpiryMs() / 1000)
                .tokenType("Bearer")
                .user(userMapper.toResponse(user))
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
