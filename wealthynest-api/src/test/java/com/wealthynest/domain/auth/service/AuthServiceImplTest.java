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
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
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
    @Mock private com.wealthynest.domain.auth.service.GoogleIdTokenValidator googleIdTokenValidator;
    // Chain wired by hand in GoogleLoginNativeTests, not RETURNS_DEEP_STUBS — see its own comment.
    @Mock private RestClient googleOAuthClient;

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
        lenient().when(jwtTokenProvider.generateRefreshToken(any(), any(), anyLong())).thenReturn("refresh-token");
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
        @DisplayName("an already-registered email sends an account-exists notice instead of creating a user, with no enumeration signal in the response")
        void sendsAccountExistsNoticeInsteadOfLeakingEnumeration() {
            RegisterRequest req = mock(RegisterRequest.class);
            when(req.getEmail()).thenReturn("Taken@Example.com");
            when(req.getPassword()).thenReturn("Password1");
            User existing = withId(baseUser().email("taken@example.com").fullName("Existing User").build());
            when(userRepository.findByEmail("taken@example.com")).thenReturn(Optional.of(existing));

            AuthResponse response = service.register(req);

            verify(userRepository, never()).save(any());
            verify(emailService).sendAccountExistsEmail("taken@example.com", "Existing User");
            verify(emailService, never()).sendVerificationEmail(any(), any(), any());
            assertThat(response.getAccessToken()).isNull();
            assertThat(response.getRefreshToken()).isNull();
            // The BCrypt cost is what makes the new-account branch slow — this branch must pay the
            // same cost, or response latency alone reveals that the email is already registered.
            verify(passwordEncoder).encode("Password1");
        }

        @Test
        @DisplayName("creates an unverified user, sends a verification email, and returns null tokens")
        void createsUnverifiedUserAndReturnsNoTokens() {
            RegisterRequest req = mock(RegisterRequest.class);
            when(req.getEmail()).thenReturn("New@Example.com");
            when(req.getFullName()).thenReturn("New User");
            when(req.getPassword()).thenReturn("Password1");
            when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
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

            assertThatThrownBy(() -> service.login(req(false), ip, ua, null)).isInstanceOf(BadCredentialsException.class);

            assertThat(user.getFailedLoginAttempts()).isEqualTo(3);
            verify(userRepository).save(user);
        }

        @Test
        @DisplayName("locks the account after the 5th consecutive failed attempt")
        void locksAccountAfterFiveFailedAttempts() {
            when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad"));
            User user = withId(baseUser().failedLoginAttempts(4).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.login(req(false), ip, ua, null)).isInstanceOf(BadCredentialsException.class);

            assertThat(user.getFailedLoginAttempts()).isEqualTo(0); // reset on lock
            assertThat(user.getLockedUntil()).isAfter(Instant.now());
        }

        @Test
        @DisplayName("an already-locked account is rejected before authentication is even attempted, with a structured ACCOUNT_LOCKED code and lockedUntil detail")
        void rejectsAlreadyLockedAccountWithStructuredError() {
            Instant lockedUntil = Instant.now().plusSeconds(300);
            User user = withId(baseUser().lockedUntil(lockedUntil).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.login(req(false), ip, ua, null))
                    .isInstanceOfSatisfying(BusinessException.class, e -> {
                        assertThat(e.getCode()).isEqualTo("ACCOUNT_LOCKED");
                        assertThat(e.getDetails()).containsKey("lockedUntil");
                    });
            verify(authenticationManager, never()).authenticate(any());
        }

        @Test
        @DisplayName("throws when the account's email is not yet verified")
        void throwsWhenEmailNotVerified() {
            when(authenticationManager.authenticate(any())).thenReturn(null);
            User user = withId(baseUser().emailVerified(false).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.login(req(false), ip, ua, null)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, resets failed-attempt counters and issues tokens")
        void successResetsCountersAndIssuesTokens() {
            when(authenticationManager.authenticate(any())).thenReturn(null);
            User user = withId(baseUser().failedLoginAttempts(3).lockedUntil(null).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            stubAuthResponseBuilding();

            AuthResponse response = service.login(req(true), ip, ua, null);

            assertThat(user.getFailedLoginAttempts()).isEqualTo(0);
            assertThat(response.getAccessToken()).isEqualTo("access-token");
            ArgumentCaptor<RefreshToken> tokenCaptor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(refreshTokenRepository).save(tokenCaptor.capture());
            assertThat(tokenCaptor.getValue().isRememberMe()).isTrue();
        }

        @Test
        @DisplayName("on success, sends a new-sign-in email to the account's own address")
        void successSendsNewSignInEmail() {
            when(authenticationManager.authenticate(any())).thenReturn(null);
            User user = withId(baseUser().email("alice@example.com").fullName("Alice").build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            stubAuthResponseBuilding();

            service.login(req(false), ip, ua, null);

            verify(emailService).sendNewSignInEmail(eq("alice@example.com"), eq("Alice"), eq(ip), eq(ua), any());
        }

        // Regression coverage for a real bug: logging in again from a device that still held an
        // earlier valid session (never explicitly signed out) left that row un-revoked, so it kept
        // accumulating as a duplicate "active session" entry every time — see
        // revokeIfOwnedByUser's own comment for why this now runs on every login path, not just
        // issueTokensForVerifiedUser's passkey ceremony.
        @Test
        @DisplayName("on success, revokes this device's previous refresh token when one is supplied")
        void successRevokesPreviousToken() {
            when(authenticationManager.authenticate(any())).thenReturn(null);
            User user = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));
            stubAuthResponseBuilding();
            RefreshToken previous = RefreshToken.builder().userId(userId).revoked(false).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(previous));

            service.login(req(false), ip, ua, "old-refresh-token");

            assertThat(previous.isRevoked()).isTrue();
        }
    }

    // ─── refresh ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("refresh")
    class RefreshTests {

        @Test
        @DisplayName("throws when the token hash is not found")
        void throwsWhenTokenNotFound() {
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.refresh("bogus", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token is revoked, and does not escalate when revokedAt is unset (logout/reset/explicit-revoke paths)")
        void throwsWhenRevoked() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(true).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            assertThatThrownBy(() -> service.refresh("t", ip, ua)).isInstanceOf(BusinessException.class);
            verify(refreshTokenRepository, never()).revokeAllByUserId(any());
            verify(tokenRevocationService, never()).revokeAllTokensFor(any());
        }

        @Test
        @DisplayName("reuse shortly after rotation (multi-tab race) rejects the request without revoking the session")
        void reuseWithinGraceWindowDoesNotEscalate() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(true)
                    .revokedAt(Instant.now().minusMillis(1_000)).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

            assertThatThrownBy(() -> service.refresh("t", ip, ua)).isInstanceOf(BusinessException.class);

            verify(refreshTokenRepository, never()).revokeAllByUserId(any());
            verify(tokenRevocationService, never()).revokeAllTokensFor(any());
        }

        @Test
        @DisplayName("reuse well after rotation is treated as theft — revokes every session for that user")
        void reuseAfterGraceWindowRevokesAllSessions() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(true)
                    .revokedAt(Instant.now().minusSeconds(30)).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

            assertThatThrownBy(() -> service.refresh("t", ip, ua)).isInstanceOf(BusinessException.class);

            verify(refreshTokenRepository).revokeAllByUserId(userId);
            verify(tokenRevocationService).revokeAllTokensFor(userId);
            verify(auditService).log(eq(userId), eq("REFRESH_TOKEN_REUSE_DETECTED"), eq("USER"), eq(userId), any(), any(), eq(ip), eq(ua));
        }

        @Test
        @DisplayName("throws when the token has expired")
        void throwsWhenExpired() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().minusSeconds(1)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            assertThatThrownBy(() -> service.refresh("t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, revokes the used token, issues a new one, and stamps it with the caller's ip/user-agent")
        void successRevokesOldTokenAndIssuesNew() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false)
                    .expiresAt(Instant.now().plusSeconds(60)).rememberMe(true).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(userRepository.findById(userId)).thenReturn(Optional.of(withId(baseUser().build())));
            stubAuthResponseBuilding();

            service.refresh("t", ip, ua);

            assertThat(stored.isRevoked()).isTrue();
            assertThat(stored.getRevokedAt()).isNotNull();
            ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
            verify(refreshTokenRepository, times(2)).save(captor.capture());
            RefreshToken newToken = captor.getAllValues().get(1);
            assertThat(newToken.getIpAddress()).isEqualTo(ip);
            assertThat(newToken.getUserAgent()).isEqualTo(ua);
        }

        @Test
        @DisplayName("does NOT send a new-sign-in email — this is the same device continuing an existing session, not a new one")
        void doesNotSendNewSignInEmail() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false)
                    .expiresAt(Instant.now().plusSeconds(60)).rememberMe(true).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            when(userRepository.findById(userId)).thenReturn(Optional.of(withId(baseUser().build())));
            stubAuthResponseBuilding();

            service.refresh("t", ip, ua);

            verifyNoInteractions(emailService);
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
        @DisplayName("throws when the token has already been used")
        void throwsWhenUsedOrExpired() {
            PasswordResetToken prt = PasswordResetToken.builder().email("alice@example.com")
                    .used(true).expiresAt(Instant.now().plusSeconds(60)).build();
            when(passwordResetTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(prt));
            assertThatThrownBy(() -> service.resetPassword(req("t", "NewPass1"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the token is unused but has expired")
        void throwsWhenExpiredButUnused() {
            PasswordResetToken prt = PasswordResetToken.builder().email("alice@example.com")
                    .used(false).expiresAt(Instant.now().minusSeconds(60)).build();
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
        @DisplayName("enablePin throws when the account doesn't exist")
        void enablePinThrowsForUnknownUser() {
            when(userRepository.findById(userId)).thenReturn(Optional.empty());
            EnablePinRequest req = mock(EnablePinRequest.class);

            assertThatThrownBy(() -> service.enablePin(userId, req)).isInstanceOf(BusinessException.class);
        }

        // No current-password check on this path (see AuthServiceImpl#enablePin's own comment for
        // why that's a deliberate call, not an oversight) — this test is really just confirming
        // that deliberate absence rather than assuming it.
        @Test
        @DisplayName("enablePin hashes and stores the PIN without requiring the current password, resetting any prior lockout state")
        void enablePinSucceedsWithoutPassword() {
            User user = withId(baseUser().pinFailedAttempts(3).pinLockedUntil(Instant.now().plusSeconds(60)).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            EnablePinRequest req = mock(EnablePinRequest.class);
            when(req.getPin()).thenReturn("1234");
            when(passwordEncoder.encode("1234")).thenReturn("pin-hash");

            service.enablePin(userId, req);

            verify(passwordEncoder, never()).matches(any(), any());
            assertThat(user.getPinHash()).isEqualTo("pin-hash");
            assertThat(user.getPinFailedAttempts()).isEqualTo(0);
            assertThat(user.getPinLockedUntil()).isNull();
        }

        private DisablePinRequest disableReq(String pin) {
            DisablePinRequest r = mock(DisablePinRequest.class);
            lenient().when(r.getPin()).thenReturn(pin);
            return r;
        }

        @Test
        @DisplayName("disablePin throws when PIN unlock isn't enabled for the account")
        void disablePinThrowsWhenNotEnabled() {
            User user = withId(baseUser().pinHash(null).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.disablePin(userId, disableReq("1234"), ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("disablePin throws LOCKED with a structured PIN_LOCKED code while the lockout window is active, without checking the PIN")
        void disablePinThrowsWhenLocked() {
            User user = withId(baseUser().pinHash("hash").pinLockedUntil(Instant.now().plusSeconds(120)).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.disablePin(userId, disableReq("1234"), ip, ua))
                    .isInstanceOfSatisfying(BusinessException.class, e -> {
                        assertThat(e.getCode()).isEqualTo("PIN_LOCKED");
                        assertThat(e.getDetails()).containsKey("lockedUntil");
                    });
            verify(passwordEncoder, never()).matches(any(), any());
        }

        @Test
        @DisplayName("disablePin rejects a wrong PIN, leaves the PIN enabled, and increments the shared failure counter")
        void disablePinRejectsWrongPin() {
            User user = withId(baseUser().pinHash("hash").pinFailedAttempts(1).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("0000", "hash")).thenReturn(false);

            assertThatThrownBy(() -> service.disablePin(userId, disableReq("0000"), ip, ua))
                    .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("INVALID_PIN"));

            assertThat(user.getPinHash()).isEqualTo("hash");
            assertThat(user.getPinFailedAttempts()).isEqualTo(2);
        }

        @Test
        @DisplayName("disablePin clears the PIN and all lockout state once the current PIN is confirmed")
        void disablePinClearsStateOnCorrectPin() {
            User user = withId(baseUser().pinHash("existing").pinFailedAttempts(2).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("1234", "existing")).thenReturn(true);

            service.disablePin(userId, disableReq("1234"), ip, ua);

            assertThat(user.getPinHash()).isNull();
            assertThat(user.getPinEnabledAt()).isNull();
            assertThat(user.getPinFailedAttempts()).isEqualTo(0);
            assertThat(user.getPinLockedUntil()).isNull();
        }
    }

    // ─── pinLogin ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("pinLogin")
    class PinLoginTests {

        private PinLoginRequest req(String pin) {
            PinLoginRequest r = mock(PinLoginRequest.class);
            lenient().when(r.getPin()).thenReturn(pin);
            return r;
        }

        @Test
        @DisplayName("throws when the backing refresh token doesn't exist")
        void throwsWhenRefreshTokenInvalid() {
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.pinLogin(req("1234"), "t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the backing refresh token has been revoked")
        void throwsWhenRefreshTokenRevoked() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(true).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            assertThatThrownBy(() -> service.pinLogin(req("1234"), "t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when PIN unlock isn't enabled for the account")
        void throwsWhenPinNotEnabled() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash(null).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.pinLogin(req("1234"), "t", ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws LOCKED with a structured PIN_LOCKED code and lockedUntil detail while the PIN lockout window is still active")
        void throwsWhenPinLocked() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash("hash").pinLockedUntil(Instant.now().plusSeconds(120)).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            assertThatThrownBy(() -> service.pinLogin(req("1234"), "t", ip, ua))
                    .isInstanceOfSatisfying(BusinessException.class, e -> {
                        assertThat(e.getCode()).isEqualTo("PIN_LOCKED");
                        assertThat(e.getDetails()).containsKey("lockedUntil");
                    });
        }

        @Test
        @DisplayName("a wrong PIN increments the failure counter and locks after the 5th attempt")
        void wrongPinLocksAfterFiveAttempts() {
            RefreshToken stored = RefreshToken.builder().userId(userId).revoked(false).expiresAt(Instant.now().plusSeconds(60)).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));
            User user = withId(baseUser().pinHash("hash").pinFailedAttempts(4).build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("0000", "hash")).thenReturn(false);

            assertThatThrownBy(() -> service.pinLogin(req("0000"), "t", ip, ua)).isInstanceOf(BusinessException.class);

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

            AuthResponse response = service.pinLogin(req("1234"), "t", ip, ua);

            assertThat(user.getPinFailedAttempts()).isEqualTo(0);
            assertThat(stored.isRevoked()).isTrue();
            assertThat(response.getAccessToken()).isEqualTo("access-token");
            // PIN unlock is the same already-recognized device continuing its session, not a new
            // sign-in — no alert email, same reasoning as refresh().
            verifyNoInteractions(emailService);
        }
    }

    // ─── googleLogin ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("googleLogin")
    class GoogleLoginTests {

        @org.mockito.Mock private com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload;

        private GoogleLoginRequest req() {
            GoogleLoginRequest r = mock(GoogleLoginRequest.class);
            lenient().when(r.getIdToken()).thenReturn("raw-id-token");
            lenient().when(r.isRememberMe()).thenReturn(false);
            return r;
        }

        @BeforeEach
        void wireGoogle() {
            ReflectionTestUtils.setField(service, "googleClientId", "test-client-id");
        }

        @Test
        @DisplayName("throws SERVICE_UNAVAILABLE when Google Sign-In isn't configured")
        void throwsWhenNotConfigured() {
            ReflectionTestUtils.setField(service, "googleClientId", "");
            GoogleLoginRequest req = mock(GoogleLoginRequest.class);

            assertThatThrownBy(() -> service.googleLogin(req, ip, ua, null)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("throws UNAUTHORIZED when the validator returns a null payload (invalid signature)")
        void throwsWhenTokenInvalid() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(null);

            assertThatThrownBy(() -> service.googleLogin(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws UNAUTHORIZED when verification itself throws (network/parsing failure)")
        void throwsWhenVerifyThrows() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenThrow(new java.security.GeneralSecurityException("boom"));

            assertThatThrownBy(() -> service.googleLogin(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws BAD_REQUEST when the Google account's email isn't verified")
        void throwsWhenEmailNotVerified() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(false);

            assertThatThrownBy(() -> service.googleLogin(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("an existing user signs in via Google without creating a duplicate account")
        void existingUserSignsIn() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("alice@example.com");
            User existing = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));
            stubAuthResponseBuilding();

            AuthResponse response = service.googleLogin(req(), ip, ua, null);

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            verify(userRepository, never()).save(argThat(u -> "GOOGLE".equals(u.getAuthProvider())));
            verify(auditService).log(eq(userId), eq("GOOGLE_LOGIN_SUCCESS"), any(), any(), any(), any(), any(), any());
            verify(emailService).sendNewSignInEmail(eq("alice@example.com"), any(), eq(ip), eq(ua), any());
        }

        // Regression coverage for a real bug: an existing LOCAL account that registered with a
        // password but never clicked its verification link could still sign in via Google (Google
        // already proves email ownership independently), yet emailVerified stayed false on the row
        // — so the same person's next password login was rejected with EMAIL_NOT_VERIFIED despite
        // Google sign-in having worked for them the whole time. See signInWithGooglePayload's own
        // comment for the full why.
        @Test
        @DisplayName("promotes an existing unverified local account's emailVerified to true")
        void promotesExistingUnverifiedAccount() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("alice@example.com");
            User existing = withId(baseUser().emailVerified(false).build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));
            stubAuthResponseBuilding();

            service.googleLogin(req(), ip, ua, null);

            assertThat(existing.isEmailVerified()).isTrue();
        }

        // Regression coverage for a real bug: signing in again via Google from a device that still
        // held an earlier valid session left that row un-revoked, accumulating as a duplicate
        // "active session" entry every time — see login's own matching test / revokeIfOwnedByUser's
        // comment for the full why.
        @Test
        @DisplayName("on success, revokes this device's previous refresh token when one is supplied")
        void successRevokesPreviousToken() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("alice@example.com");
            User existing = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));
            stubAuthResponseBuilding();
            RefreshToken previous = RefreshToken.builder().userId(userId).revoked(false).build();
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(previous));

            service.googleLogin(req(), ip, ua, "old-refresh-token");

            assertThat(previous.isRevoked()).isTrue();
        }

        @Test
        @DisplayName("a first-time Google sign-in registers a new account with a random local password")
        void newUserIsRegistered() throws Exception {
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("newperson@example.com");
            when(payload.get("name")).thenReturn("New Person");
            when(userRepository.findByEmail("newperson@example.com")).thenReturn(Optional.empty());
            when(passwordEncoder.encode(anyString())).thenReturn("random-hash");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            stubAuthResponseBuilding();

            service.googleLogin(req(), ip, ua, null);

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository, atLeastOnce()).save(captor.capture());
            User saved = captor.getAllValues().get(0);
            assertThat(saved.getAuthProvider()).isEqualTo("GOOGLE");
            assertThat(saved.getFullName()).isEqualTo("New Person");
            assertThat(saved.isEmailVerified()).isTrue();
            verify(auditService).log(eq(userId), eq("GOOGLE_SIGNUP"), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("defers the GOOGLE_SIGNUP audit log to after commit when a real transaction is active")
        void newUserAuditLogIsDeferredToAfterCommit() throws Exception {
            // auditService.log() is @Async + REQUIRES_NEW, so it runs on a connection that can't
            // see this transaction's own not-yet-committed INSERT of the new user row — logging
            // immediately risks the audit row's FK losing that race (reproduced in prod: brand-new
            // Google signups intermittently failed with "not present in table users"). Simulating a
            // real active transaction here (Mockito's own service instance has none by default,
            // which is exactly why the test above sees the call happen immediately instead) proves
            // the fix actually defers to afterCommit() rather than logging eagerly.
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("deferred@example.com");
            when(payload.get("name")).thenReturn("Deferred Person");
            when(userRepository.findByEmail("deferred@example.com")).thenReturn(Optional.empty());
            when(passwordEncoder.encode(anyString())).thenReturn("random-hash");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            stubAuthResponseBuilding();

            org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
            try {
                service.googleLogin(req(), ip, ua, null);

                verifyNoInteractions(auditService);
                org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                        .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
            } finally {
                org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
            }

            verify(auditService).log(eq(userId), eq("GOOGLE_SIGNUP"), any(), any(), any(), any(), any(), any());
            verify(auditService).log(eq(userId), eq("GOOGLE_LOGIN_SUCCESS"), any(), any(), any(), any(), any(), any());
        }
    }

    // ─── googleLoginNative ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("googleLoginNative")
    class GoogleLoginNativeTests {

        @org.mockito.Mock private com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload;
        // Wired by hand rather than RETURNS_DEEP_STUBS — see feedback_test_infra_patterns: deep
        // stubs on RestClient's fluent builder silently return null past certain calls in this
        // chain, which surfaced here as every post-exchange test failing with "Google sign-in
        // failed" instead of exercising the success path the stub was meant to set up.
        @org.mockito.Mock private RestClient.RequestBodyUriSpec requestSpec;
        @org.mockito.Mock private RestClient.ResponseSpec       responseSpec;

        private GoogleCodeLoginRequest req() {
            GoogleCodeLoginRequest r = mock(GoogleCodeLoginRequest.class);
            lenient().when(r.getCode()).thenReturn("auth-code");
            lenient().when(r.getCodeVerifier()).thenReturn("pkce-verifier");
            lenient().when(r.getRedirectUri()).thenReturn("com.googleusercontent.apps.test:/oauth2redirect");
            lenient().when(r.isRememberMe()).thenReturn(false);
            return r;
        }

        @BeforeEach
        void wireGoogleNative() {
            ReflectionTestUtils.setField(service, "googleNativeClientId", "test-native-client-id");
            ReflectionTestUtils.setField(service, "googleNativeClientSecret", "test-native-secret");
            lenient().when(googleOAuthClient.post()).thenReturn(requestSpec);
            lenient().when(requestSpec.uri(anyString())).thenReturn(requestSpec);
            lenient().when(requestSpec.contentType(any())).thenReturn(requestSpec);
            // any(Object.class), not bare any() — RequestBodySpec.body() is overloaded
            // (body(Object) vs body(StreamingHttpOutputMessage.Body)), and an untyped any()
            // resolves to the MORE SPECIFIC Body overload at compile time, silently stubbing a
            // method the real body(form) call — which resolves to body(Object) — never invokes.
            lenient().when(requestSpec.body(any(Object.class))).thenReturn(requestSpec);
            lenient().when(requestSpec.retrieve()).thenReturn(responseSpec);
        }

        private void stubTokenExchange(Map<String, Object> response) {
            lenient().when(responseSpec.body(Map.class)).thenReturn(response);
        }

        @Test
        @DisplayName("throws SERVICE_UNAVAILABLE when the native client id/secret aren't configured")
        void throwsWhenNotConfigured() {
            ReflectionTestUtils.setField(service, "googleNativeClientId", "");
            GoogleCodeLoginRequest req = mock(GoogleCodeLoginRequest.class);

            assertThatThrownBy(() -> service.googleLoginNative(req, ip, ua, null)).isInstanceOf(BusinessException.class);
            // Not googleOAuthClient too — wireGoogleNative()'s own stub setup above already calls
            // .post() once to build the chain, so "no interactions" wouldn't hold for that mock.
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("throws UNAUTHORIZED when Google's token endpoint rejects the exchange")
        void throwsWhenExchangeFails() {
            when(responseSpec.body(Map.class)).thenThrow(new RestClientException("invalid_client"));

            assertThatThrownBy(() -> service.googleLoginNative(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("throws UNAUTHORIZED when the token response has no id_token")
        void throwsWhenNoIdTokenInResponse() {
            stubTokenExchange(Map.of("access_token", "some-access-token"));

            assertThatThrownBy(() -> service.googleLoginNative(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(googleIdTokenValidator, userRepository);
        }

        @Test
        @DisplayName("throws UNAUTHORIZED when the exchanged id_token fails verification")
        void throwsWhenIdTokenInvalid() throws Exception {
            stubTokenExchange(Map.of("id_token", "raw-id-token"));
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(null);

            assertThatThrownBy(() -> service.googleLoginNative(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("an existing user signs in via native Google without creating a duplicate account")
        void existingUserSignsIn() throws Exception {
            stubTokenExchange(Map.of("id_token", "raw-id-token"));
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("alice@example.com");
            User existing = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));
            stubAuthResponseBuilding();

            AuthResponse response = service.googleLoginNative(req(), ip, ua, null);

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            verify(userRepository, never()).save(argThat(u -> "GOOGLE".equals(u.getAuthProvider())));
            verify(auditService).log(eq(userId), eq("GOOGLE_LOGIN_SUCCESS"), any(), any(), any(), any(), any(), any());
        }

        @Test
        @DisplayName("a first-time native Google sign-in registers a new account")
        void newUserIsRegistered() throws Exception {
            stubTokenExchange(Map.of("id_token", "raw-id-token"));
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("newperson@example.com");
            when(payload.get("name")).thenReturn("New Person");
            when(userRepository.findByEmail("newperson@example.com")).thenReturn(Optional.empty());
            when(passwordEncoder.encode(anyString())).thenReturn("random-hash");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            stubAuthResponseBuilding();

            service.googleLoginNative(req(), ip, ua, null);

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository, atLeastOnce()).save(captor.capture());
            User saved = captor.getAllValues().get(0);
            assertThat(saved.getAuthProvider()).isEqualTo("GOOGLE");
            assertThat(saved.getFullName()).isEqualTo("New Person");
            verify(auditService).log(eq(userId), eq("GOOGLE_SIGNUP"), any(), any(), any(), any(), any(), any());
        }
    }

    // ─── googleLoginPopup ────────────────────────────────────────────────────────
    // Web counterpart to googleLoginNative above — same exchange-then-verify-then-sign-in shape,
    // just reading googleClientId/googleClientSecret (the "Web application" client) instead of the
    // native fields, and never sending a code_verifier. Doesn't re-cover every branch
    // GoogleLoginNativeTests already exercises against the shared exchange/verify helpers — only
    // what's actually distinct about this method: its own config guard, and that it reaches
    // sign-in successfully end to end.

    @Nested
    @DisplayName("googleLoginPopup")
    class GoogleLoginPopupTests {

        @org.mockito.Mock private com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload;
        @org.mockito.Mock private RestClient.RequestBodyUriSpec requestSpec;
        @org.mockito.Mock private RestClient.ResponseSpec       responseSpec;

        private GoogleCodeLoginRequest req() {
            GoogleCodeLoginRequest r = mock(GoogleCodeLoginRequest.class);
            lenient().when(r.getCode()).thenReturn("auth-code");
            lenient().when(r.getCodeVerifier()).thenReturn(null); // GIS's popup code-flow never has one
            lenient().when(r.getRedirectUri()).thenReturn("postmessage");
            lenient().when(r.isRememberMe()).thenReturn(false);
            return r;
        }

        @BeforeEach
        void wireGooglePopup() {
            ReflectionTestUtils.setField(service, "googleClientId", "test-web-client-id");
            ReflectionTestUtils.setField(service, "googleClientSecret", "test-web-secret");
            lenient().when(googleOAuthClient.post()).thenReturn(requestSpec);
            lenient().when(requestSpec.uri(anyString())).thenReturn(requestSpec);
            lenient().when(requestSpec.contentType(any())).thenReturn(requestSpec);
            lenient().when(requestSpec.body(any(Object.class))).thenReturn(requestSpec);
            lenient().when(requestSpec.retrieve()).thenReturn(responseSpec);
        }

        @Test
        @DisplayName("throws SERVICE_UNAVAILABLE when the web client id/secret aren't configured")
        void throwsWhenNotConfigured() {
            ReflectionTestUtils.setField(service, "googleClientSecret", "");

            assertThatThrownBy(() -> service.googleLoginPopup(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("throws UNAUTHORIZED when Google's token endpoint rejects the exchange")
        void throwsWhenExchangeFails() {
            when(responseSpec.body(Map.class)).thenThrow(new RestClientException("invalid_grant"));

            assertThatThrownBy(() -> service.googleLoginPopup(req(), ip, ua, null)).isInstanceOf(BusinessException.class);
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("an existing user signs in via the web popup fallback without creating a duplicate account")
        void existingUserSignsIn() throws Exception {
            when(responseSpec.body(Map.class)).thenReturn(Map.of("id_token", "raw-id-token"));
            when(googleIdTokenValidator.verify("raw-id-token")).thenReturn(payload);
            when(payload.getEmailVerified()).thenReturn(true);
            when(payload.getEmail()).thenReturn("alice@example.com");
            User existing = withId(baseUser().build());
            when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(existing));
            stubAuthResponseBuilding();

            AuthResponse response = service.googleLoginPopup(req(), ip, ua, null);

            assertThat(response.getAccessToken()).isEqualTo("access-token");
            verify(userRepository, never()).save(argThat(u -> "GOOGLE".equals(u.getAuthProvider())));
            verify(auditService).log(eq(userId), eq("GOOGLE_LOGIN_SUCCESS"), any(), any(), any(), any(), any(), any());
        }
    }

    // ─── issueTokensForVerifiedUser ──────────────────────────────────────────────

    @Test
    @DisplayName("issueTokensForVerifiedUser throws for an unknown user and otherwise issues tokens")
    void issueTokensForVerifiedUser() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.issueTokensForVerifiedUser(userId, false, ip, ua, null)).isInstanceOf(BusinessException.class);

        User user = withId(baseUser().build());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        stubAuthResponseBuilding();

        AuthResponse response = service.issueTokensForVerifiedUser(userId, false, ip, ua, null);
        assertThat(response.getAccessToken()).isEqualTo("access-token");
    }

    @Test
    @DisplayName("issueTokensForVerifiedUser revokes the device's previous refresh token when one is supplied")
    void issueTokensForVerifiedUserRevokesPreviousToken() {
        User user = withId(baseUser().build());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        stubAuthResponseBuilding();
        RefreshToken previous = RefreshToken.builder().userId(userId).revoked(false).build();
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(previous));

        service.issueTokensForVerifiedUser(userId, false, ip, ua, "old-refresh-token");

        assertThat(previous.isRevoked()).isTrue();
    }

    @Test
    @DisplayName("issueTokensForVerifiedUser silently ignores a previous token that doesn't belong to this user")
    void issueTokensForVerifiedUserIgnoresForeignToken() {
        User user = withId(baseUser().build());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        stubAuthResponseBuilding();
        RefreshToken foreign = RefreshToken.builder().userId(UUID.randomUUID()).revoked(false).build();
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(foreign));

        service.issueTokensForVerifiedUser(userId, false, ip, ua, "someone-elses-token");

        assertThat(foreign.isRevoked()).isFalse();
    }

    @Test
    @DisplayName("issueTokensForVerifiedUser doesn't touch the repository when no previous token is supplied")
    void issueTokensForVerifiedUserSkipsLookupWithoutPreviousToken() {
        User user = withId(baseUser().build());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        stubAuthResponseBuilding();

        service.issueTokensForVerifiedUser(userId, false, ip, ua, "");

        verify(refreshTokenRepository, never()).findByTokenHash(anyString());
    }

    // ─── sessions ────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("sessions")
    class SessionsTests {

        @Test
        @DisplayName("lists active sessions and flags the one matching the caller's own refresh token as current")
        void listsSessionsAndFlagsCurrent() {
            RefreshToken mine  = RefreshToken.builder().userId(userId).tokenHash(hash("mine")).ipAddress("1.1.1.1").userAgent("Chrome").build();
            RefreshToken other = RefreshToken.builder().userId(userId).tokenHash(hash("other")).ipAddress("2.2.2.2").userAgent("Safari").build();
            when(refreshTokenRepository.findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(eq(userId), any()))
                    .thenReturn(java.util.List.of(mine, other));

            var sessions = service.listSessions(userId, "mine");

            assertThat(sessions).hasSize(2);
            assertThat(sessions.stream().filter(com.wealthynest.domain.auth.dto.response.SessionResponse::isCurrent))
                    .extracting(com.wealthynest.domain.auth.dto.response.SessionResponse::getIpAddress)
                    .containsExactly("1.1.1.1");
        }

        @Test
        @DisplayName("listSessions with no current token flags nothing as current")
        void listSessionsWithoutCurrentTokenFlagsNothing() {
            RefreshToken token = RefreshToken.builder().userId(userId).tokenHash(hash("mine")).build();
            when(refreshTokenRepository.findByUserIdAndRevokedFalseAndExpiresAtAfterOrderByCreatedAtDesc(eq(userId), any()))
                    .thenReturn(java.util.List.of(token));

            var sessions = service.listSessions(userId, null);

            assertThat(sessions).extracting(com.wealthynest.domain.auth.dto.response.SessionResponse::isCurrent).containsExactly(false);
        }

        @Test
        @DisplayName("revokeSession throws for a session that doesn't belong to this user")
        void revokeSessionThrowsForWrongUser() {
            when(refreshTokenRepository.findByIdAndUserId(any(), eq(userId))).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.revokeSession(userId, UUID.randomUUID()))
                    .isInstanceOf(com.wealthynest.common.exception.ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("revokeSession revokes the matching row")
        void revokeSessionRevokes() {
            UUID sessionId = UUID.randomUUID();
            RefreshToken token = RefreshToken.builder().userId(userId).revoked(false).build();
            when(refreshTokenRepository.findByIdAndUserId(sessionId, userId)).thenReturn(Optional.of(token));

            service.revokeSession(userId, sessionId);

            assertThat(token.isRevoked()).isTrue();
            verify(refreshTokenRepository).save(token);
        }

        @Test
        @DisplayName("revokeOtherSessions delegates to the repository with the hash of the current token")
        void revokeOtherSessionsDelegates() {
            service.revokeOtherSessions(userId, "mine");
            verify(refreshTokenRepository).revokeAllByUserIdExcept(userId, hash("mine"));
        }

        private String hash(String raw) {
            try {
                java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
                return Base64.getEncoder().encodeToString(digest.digest(raw.getBytes(StandardCharsets.UTF_8)));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }
}
