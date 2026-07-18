package com.wealthynest.domain.auth.service;

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
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.infra.email.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock private UserRepository                   userRepository;
    @Mock private RefreshTokenRepository            refreshTokenRepository;
    @Mock private PasswordResetTokenRepository      passwordResetTokenRepository;
    @Mock private EmailVerificationTokenRepository  emailVerificationTokenRepository;
    @Mock private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock private JwtTokenProvider                  jwtTokenProvider;
    @Mock private AuthenticationManager             authenticationManager;
    @Mock private UserMapper                        userMapper;
    @Mock private JwtProperties                     jwtProperties;
    @Mock private EmailService                      emailService;
    @Mock private AuditService                      auditService;
    @Mock private TokenRevocationService             tokenRevocationService;

    @InjectMocks
    private AuthServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final String ip = "127.0.0.1";
    private final String ua = "JUnit";

    @BeforeEach
    void wireValueFields() {
        ReflectionTestUtils.setField(service, "frontendUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(service, "resetTokenExpiryMinutes", 15);
        ReflectionTestUtils.setField(service, "googleClientId", "");
    }

    private User.UserBuilder baseUser() {
        return User.builder().fullName("Alice").email("alice@example.com")
                .passwordHash("hashed").role(UserRole.MEMBER).emailVerified(true);
    }

    private User withId(User u) {
        ReflectionTestUtils.setField(u, "id", userId);
        return u;
    }

    private void stubAuthResponseBuilding() {
        lenient().when(jwtTokenProvider.generateAccessToken(any(), any(), any())).thenReturn("access-token");
        lenient().when(jwtTokenProvider.generateRefreshToken(any(), any())).thenReturn("refresh-token");
        lenient().when(jwtProperties.getRefreshTokenExpiryMs()).thenReturn(2592000000L);
        lenient().when(jwtProperties.getAccessTokenExpiryMs()).thenReturn(7200000L);
        lenient().when(userMapper.toResponse(any(User.class))).thenReturn(UserResponse.builder().build());
        lenient().when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ─── register ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("register")
    class RegisterTests {

        @Test
        @DisplayName("throws CONFLICT when the email is already registered")
        void throwsWhenEmailExists() {
            RegisterRequest req = mock(RegisterRequest.class);
            when(req.getEmail()).thenReturn("taken@example.com");
            when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);

            assertThatThrownBy(() -> service.register(req)).isInstanceOf(BusinessException.class);
            verify(userRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates an unverified user, sends a verification email, and returns null tokens")
        void createsUnverifiedUserAndReturnsNoTokens() {
            RegisterRequest req = mock(RegisterRequest.class);
            when(req.getEmail()).thenReturn("New@Example.com");
            when(req.getFullName()).thenReturn("New User");
            when(req.getPassword()).thenReturn("Password1");
            when(userRepository.existsByEmail("New@Example.com")).thenReturn(false);
            when(passwordEncoder.encode("Password1")).thenReturn("hashed-pw");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(userMapper.toResponse(any())).thenReturn(UserResponse.builder().build());

            AuthResponse response = service.register(req);

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getEmail()).isEqualTo("new@example.com"); // lowercased
            assertThat(captor.getValue().isEmailVerified()).isFalse();
            assertThat(response.getAccessToken()).isNull();
            assertThat(response.getRefreshToken()).isNull();
            verify(emailService).sendVerificationEmail(eq("new@example.com"), eq("New User"), anyString());
        }
    }

    // ─── login ───────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("login")
    class LoginTests {

        private LoginRequest req(boolean rememberMe) {
            LoginRequest r = mock(LoginRequest.class);
            lenient().when(r.getEmail()).thenReturn("alice@example.com");
            lenient().when(r.getPassword()).thenReturn("Password1");
            lenient().when(r.isRememberMe()).thenReturn(rememberMe);
            return r;
        }

        @Test
        @DisplayName("bad credentials register a failed-login attempt and rethrow")
        void badCredentialsRegistersFailedLoginAndRethrows() {
            when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
            User user = withId(baseUser().failedLoginAttempts(2).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.login(req(false), ip, ua)).isInstanceOf(BadCredentialsException.class);

            assertThat(user.getFailedLoginAttempts()).isEqualTo(3);
            verify(userRepository).save(user);
        }

        @Test
        @DisplayName("locks the account after the 5th consecutive failed attempt")
        void locksAccountAfterFiveFailedAttempts() {
            when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
            User user = withId(baseUser().failedLoginAttempts(4).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.login(req(false), ip, ua)).isInstanceOf(BadCredentialsException.class);

            assertThat(user.getFailedLoginAttempts()).isEqualTo(0); // reset on lock
            assertThat(user.getLockedUntil()).isAfter(Instant.now());
        }

        @Test
        @DisplayName("throws when the account's email is not yet verified")
        void throwsWhenEmailNotVerified() {
            when(authenticationManager.authenticate(any())).thenReturn(null);
            User user = withId(baseUser().emailVerified(false).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.login(req(false), ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, resets failed-attempt counters and issues tokens")
        void successResetsCountersAndIssuesTokens() {
            when(authenticationManager.authenticate(any())).thenReturn(null);
            User user = withId(baseUser().failedLoginAttempts(3).lockedUntil(null).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            stubAuthResponseBuilding();

            AuthResponse response = service.login(req(true), ip, ua);

            assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
            assertThat(response.getAccessToken()).isEqualTo("access-token");
            ArgumentCaptor<RefreshToken> tokenCaptor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(refreshTokenRepository).save(tokenCaptor.capture());
            assertThat(tokenCaptor.getValue().isRememberMe()).isTrue();
        }
    }

    // ─── refresh ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("refresh")
    class RefreshTests {

        private RefreshTokenRequest req(String token) {
            RefreshTokenRequest r = mock(RefreshTokenRequest.class);
            when(r.getRefreshToken()).thenReturn(token);
            return r;
        }

        @Test
        @DisplayName("throws when the token hash is not found")
        void throwsWhenTokenNotFound() {
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.refresh(req("bogus"))).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token is revoked")
        void throwsWhenRevoked() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(true).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            assertThatThrownBy(() -> service.refresh(req("t"))).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token has expired")
        void throwsWhenExpired() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().minusSeconds(1)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            assertThatThrownBy(() -> service.refresh(req("t"))).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, revokes the used token and issues a new one")
        void successRevokesOldTokenAndIssuesNew() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false)
                    .expiresAt(Instant.now().plusSeconds(60)).rememberMe(true).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(userRepository.findById(userId)).thenReturn(Optional.of(withId(baseUser().build())));
            stubAuthResponseBuilding();

            service.refresh(req("t"));

            assertThat(stored.isRevoked()).isTrue();
        }
    }

    // ─── logout ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("logout revokes the matching token if found, no-ops silently if not")
    void logoutRevokesTokenIfFound() {
        RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).build();
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        service.logout("t", ip, ua);

        assertThat(stored.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(stored);
    }

    @Test
    @DisplayName("logout with an unknown token does not throw")
    void logoutUnknownTokenNoOp() {
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
        service.logout("bogus", ip, ua); // no exception
        verify(refreshTokenRepository, never()).save(any());
    }

    // ─── verifyEmail ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("verifyEmail")
    class VerifyEmailTests {

        @Test
        @DisplayName("throws when the token is not found")
        void throwsWhenNotFound() {
            when(emailVerificationTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.verifyEmail("t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token is already used")
        void throwsWhenUsed() {
            EmailVerificationToken evt = EmailVerificationToken.builder().userId(userId).used(true)
                    .expiresAt(Instant.now().plusSeconds(60)).build();
            when(emailVerificationTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(evt));
            assertThatThrownBy(() -> service.verifyEmail("t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token has expired")
        void throwsWhenExpired() {
            EmailVerificationToken evt = EmailVerificationToken.builder().userId(userId).used(false)
                    .expiresAt(Instant.now().minusSeconds(1)).build();
            when(emailVerificationTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(evt));
            assertThatThrownBy(() -> service.verifyEmail("t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("plain signup verification flips emailVerified and marks the token used")
        void plainVerificationFlipsFlag() {
            EmailVerificationToken evt = EmailVerificationToken.builder().userId(userId).used(false)
                    .expiresAt(Instant.now().plusSeconds(60)).build();
            when(emailVerificationTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(evt));
            User user = withId(baseUser().emailVerified(false).pendingEmail(null).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            service.verifyEmail("t", ip, ua);

            assertThat(user.isEmailVerified()).isTrue();
            assertThat(evt.isUsed()).isTrue();
        }

        @Test
        @DisplayName("with a pendingEmail, promotes it to the primary email instead of just flipping the flag")
        void pendingEmailPromotedOnVerification() {
            EmailVerificationToken evt = EmailVerificationToken.builder().userId(userId).used(false)
                    .expiresAt(Instant.now().plusSeconds(60)).build();
            when(emailVerificationTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(evt));
            User user = withId(baseUser().email("old@example.com").pendingEmail("new@example.com").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(userRepository.existsByEmail("new@example.com")).thenReturn(false);

            service.verifyEmail("t", ip, ua);

            assertThat(user.getEmail()).isEqualTo("new@example.com");
            assertThat(user.getPendingEmail()).isNull();
        }

        @Test
        @DisplayName("rejects promoting a pendingEmail that another account has since claimed")
        void rejectsPendingEmailAlreadyTaken() {
            EmailVerificationToken evt = EmailVerificationToken.builder().userId(userId).used(false)
                    .expiresAt(Instant.now().plusSeconds(60)).build();
            when(emailVerificationTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(evt));
            User user = withId(baseUser().email("old@example.com").pendingEmail("new@example.com").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(userRepository.existsByEmail("new@example.com")).thenReturn(true);

            assertThatThrownBy(() -> service.verifyEmail("t", ip, ua)).isInstanceOf(BusinessException.class);
            assertThat(user.getEmail()).isEqualTo("old@example.com"); // untouched
        }
    }

    // ─── changeEmail ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("changeEmail")
    class ChangeEmailTests {

        private ChangeEmailRequest req(String newEmail, String currentPassword) {
            ChangeEmailRequest r = mock(ChangeEmailRequest.class);
            lenient().when(r.getNewEmail()).thenReturn(newEmail);
            lenient().when(r.getCurrentPassword()).thenReturn(currentPassword);
            return r;
        }

        @Test
        @DisplayName("throws when the current password is wrong")
        void throwsWhenPasswordWrong() {
            User user = withId(baseUser().build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

            assertThatThrownBy(() -> service.changeEmail(userId, req("new@example.com", "wrong"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the new email is the same as the current one")
        void throwsWhenSameEmail() {
            User user = withId(baseUser().email("alice@example.com").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("Password1", "hashed")).thenReturn(true);

            assertThatThrownBy(() -> service.changeEmail(userId, req("alice@example.com", "Password1"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the new email is already registered to someone else")
        void throwsWhenNewEmailTaken() {
            User user = withId(baseUser().build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("Password1", "hashed")).thenReturn(true);
            when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);

            assertThatThrownBy(() -> service.changeEmail(userId, req("taken@example.com", "Password1"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, sets pendingEmail (not the live email) and sends a verification link")
        void successSetsPendingEmailAndSendsLink() {
            User user = withId(baseUser().build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("Password1", "hashed")).thenReturn(true);
            when(userRepository.existsByEmail("new@example.com")).thenReturn(false);

            service.changeEmail(userId, req("new@example.com", "Password1"), ip, ua);

            assertThat(user.getPendingEmail()).isEqualTo("new@example.com");
            assertThat(user.getEmail()).isEqualTo("alice@example.com"); // unchanged until verified
            verify(emailService).sendVerificationEmail(eq("new@example.com"), any(), anyString());
        }
    }

    // ─── forgotPassword ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("forgotPassword")
    class ForgotPasswordTests {

        @Test
        @DisplayName("silently no-ops for an unregistered email (doesn't reveal whether it exists)")
        void silentForUnknownEmail() {
            ForgotPasswordRequest req = mock(ForgotPasswordRequest.class);
            when(req.getEmail()).thenReturn("nobody@example.com");
            when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

            service.forgotPassword(req); // no exception

            verify(emailService, never()).sendPasswordResetEmail(any(), any(), any());
        }

        @Test
        @DisplayName("for a known email, creates a reset token and sends the reset email")
        void createsTokenAndSendsEmailForKnownUser() {
            ForgotPasswordRequest req = mock(ForgotPasswordRequest.class);
            when(req.getEmail()).thenReturn("alice@example.com");
            User user = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            service.forgotPassword(req);

            verify(passwordResetTokenRepository).deleteByEmail("alice@example.com");
            verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
            verify(emailService).sendPasswordResetEmail(eq("alice@example.com"), any(), anyString());
        }
    }

    // ─── resetPassword ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("resetPassword")
    class ResetPasswordTests {

        private ResetPasswordRequest req(String token, String newPassword) {
            ResetPasswordRequest r = mock(ResetPasswordRequest.class);
            lenient().when(r.getToken()).thenReturn(token);
            lenient().when(r.getNewPassword()).thenReturn(newPassword);
            return r;
        }

        @Test
        @DisplayName("throws when the token is not found")
        void throwsWhenNotFound() {
            when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.resetPassword(req("t", "NewPass1"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token is already used or expired")
        void throwsWhenUsedOrExpired() {
            PasswordResetToken prt = PasswordResetToken.builder().email("alice@example.com")
                    .used(true).expiresAt(Instant.now().plusSeconds(60)).build();
            when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(prt));
            assertThatThrownBy(() -> service.resetPassword(req("t", "NewPass1"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, updates the password, invalidates the token, and revokes ALL sessions and outstanding access tokens")
        void successRevokesEverySession() {
            PasswordResetToken prt = PasswordResetToken.builder().email("alice@example.com")
                    .used(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(prt));
            User user = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            when(passwordEncoder.encode("NewPass1")).thenReturn("new-hash");

            service.resetPassword(req("t", "NewPass1"), ip, ua);

            assertThat(user.getPasswordHash()).isEqualTo("new-hash");
            assertThat(prt.isUsed()).isTrue();
            verify(refreshTokenRepository).revokeAllByUserId(userId);
            verify(tokenRevocationService).revokeAllTokensFor(userId);
        }
    }

    // ─── enablePin / disablePin ──────────────────────────────────────────────────

    @Nested
    @DisplayName("enablePin / disablePin")
    class PinManagementTests {

        @Test
        @DisplayName("enablePin throws when the current password is wrong")
        void enablePinThrowsOnWrongPassword() {
            User user = withId(baseUser().build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            EnablePinRequest req = mock(EnablePinRequest.class);
            when(req.getCurrentPassword()).thenReturn("wrong");
            when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);

            assertThatThrownBy(() -> service.enablePin(userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("enablePin hashes and stores the PIN, resetting any prior lockout state")
        void enablePinSucceeds() {
            User user = withId(baseUser().pinFailedAttempts(3).pinLockedUntil(Instant.now().plusSeconds(60)).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            EnablePinRequest req = mock(EnablePinRequest.class);
            when(req.getCurrentPassword()).thenReturn("Password1");
            when(req.getPin()).thenReturn("1234");
            when(passwordEncoder.matches("Password1", "hashed")).thenReturn(true);
            when(passwordEncoder.encode("1234")).thenReturn("pin-hash");

            service.enablePin(userId, req);

            assertThat(user.getPinHash()).isEqualTo("pin-hash");
            assertThat(user.getPinFailedAttempts()).isEqualTo(0);
            assertThat(user.getPinLockedUntil()).isNull();
        }

        @Test
        @DisplayName("disablePin clears the PIN and all lockout state")
        void disablePinClearsState() {
            User user = withId(baseUser().pinHash("existing").pinFailedAttempts(2).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            service.disablePin(userId);

            assertThat(user.getPinHash()).isNull();
            assertThat(user.getPinFailedAttempts()).isEqualTo(0);
        }
    }

    // ─── pinLogin ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("pinLogin")
    class PinLoginTests {

        private PinLoginRequest req(String refreshToken, String pin) {
            PinLoginRequest r = mock(PinLoginRequest.class);
            lenient().when(r.getRefreshToken()).thenReturn(refreshToken);
            lenient().when(r.getPin()).thenReturn(pin);
            return r;
        }

        @Test
        @DisplayName("throws when the backing refresh token is invalid or revoked/expired")
        void throwsWhenRefreshTokenInvalid() {
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.pinLogin(req("t", "1234"), ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when PIN unlock isn't enabled for the account")
        void throwsWhenPinNotEnabled() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash(null).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.pinLogin(req("t", "1234"), ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws LOCKED while the PIN lockout window is still active")
        void throwsWhenPinLocked() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash("hash").pinLockedUntil(Instant.now().plusSeconds(120)).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.pinLogin(req("t", "1234"), ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("a wrong PIN increments the failure counter and locks after the 5th attempt")
        void wrongPinLocksAfterFiveAttempts() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash("hash").pinFailedAttempts(4).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("0000", "hash")).thenReturn(false);

            assertThatThrownBy(() -> service.pinLogin(req("t", "0000"), ip, ua)).isInstanceOf(BusinessException.class);

            assertThat(user.getPinFailedAttempts()).isEqualTo(0); // reset on lock
            assertThat(user.getPinLockedUntil()).isAfter(Instant.now());
        }

        @Test
        @DisplayName("a correct PIN resets failure counters, rotates the refresh token, and issues new tokens")
        void correctPinSucceedsAndRotatesToken() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false)
                    .expiresAt(Instant.now().plusSeconds(60)).rememberMe(true).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash("hash").pinFailedAttempts(2).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("1234", "hash")).thenReturn(true);
            stubAuthResponseBuilding();

            AuthResponse response = service.pinLogin(req("t", "1234"), ip, ua);

            assertThat(user.getPinFailedAttempts()).isEqualTo(0);
            assertThat(stored.isRevoked()).isTrue();
            assertThat(response.getAccessToken()).isEqualTo("access-token");
        }
    }

    // ─── googleLogin ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("googleLogin throws SERVICE_UNAVAILABLE when Google Sign-In isn't configured")
    void googleLoginThrowsWhenNotConfigured() {
        ReflectionTestUtils.setField(service, "googleClientId", "");
        GoogleLoginRequest req = mock(GoogleLoginRequest.class);

        assertThatThrownBy(() -> service.googleLogin(req, ip, ua)).isInstanceOf(BusinessException.class);
        verifyNoInteractions(userRepository);
    }

    // ─── issueTokensForVerifiedUser ──────────────────────────────────────────────

    @Test
    @DisplayName("issueTokensForVerifiedUser throws for an unknown user and otherwise issues tokens")
    void issueTokensForVerifiedUser() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.issueTokensForVerifiedUser(userId, false)).isInstanceOf(BusinessException.class);

        User user = withId(baseUser().build());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        stubAuthResponseBuilding();

        AuthResponse response = service.issueTokensForVerifiedUser(userId, false);
        assertThat(response.getAccessToken()).isEqualTo("access-token");
    }
}
