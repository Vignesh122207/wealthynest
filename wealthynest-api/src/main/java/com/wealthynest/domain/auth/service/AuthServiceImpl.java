package com.wealthynest.domain.auth.service;

import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.security.JwtTokenProvider;
import com.wealthynest.config.JwtProperties;
import com.wealthynest.domain.auth.dto.request.ForgotPasswordRequest;
import com.wealthynest.domain.auth.dto.request.LoginRequest;
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

    @Value("${wealthynest.mail.frontend-url}")
    private String frontendUrl;

    @Value("${wealthynest.mail.reset-token-expiry-minutes:15}")
    private int resetTokenExpiryMinutes;

    /** Short session TTL when "remember me" is NOT checked (1 day). */
    private static final long SHORT_REFRESH_TTL_MS = 24L * 60 * 60 * 1000;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

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
    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));
        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow(() -> new BusinessException("User not found", HttpStatus.NOT_FOUND));

        if (!user.isEmailVerified()) {
            throw new BusinessException(
                "Email not verified. Check your inbox for a verification link.",
                HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED");
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        return buildAuthResponse(user, request.isRememberMe());
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
    public void logout(String refreshToken) {
        String tokenHash = hashToken(refreshToken);
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(t -> {
            t.setRevoked(true);
            refreshTokenRepository.save(t);
        });
    }

    @Override
    @Transactional
    public void verifyEmail(String token) {
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

        user.setEmailVerified(true);
        userRepository.save(user);

        evt.setUsed(true);
        emailVerificationTokenRepository.save(evt);

        log.info("Email verified for user {}", user.getId());
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
    public void resetPassword(ResetPasswordRequest request) {
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
        log.info("Password reset successful for user {}", user.getId());
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
