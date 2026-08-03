package com.wealthynest.domain.user.service;

import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.security.TokenRevocationService;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.auth.repository.WebAuthnCredentialRepository;
import com.wealthynest.domain.user.dto.request.ChangePasswordRequest;
import com.wealthynest.domain.user.dto.request.UpdateProfileRequest;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock private UserRepository               userRepository;
    @Mock private UserMapper                   userMapper;
    @Mock private PasswordEncoder              passwordEncoder;
    @Mock private RefreshTokenRepository       refreshTokenRepository;
    @Mock private AuditService                 auditService;
    @Mock private TokenRevocationService       tokenRevocationService;
    @Mock private WebAuthnCredentialRepository webAuthnCredentialRepository;

    @InjectMocks
    private UserServiceImpl service;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void stubMapperPassthrough() {
        lenient().when(userMapper.toResponse(any(User.class), anyBoolean())).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            return UserResponse.builder().id(u.getId()).fullName(u.getFullName()).build();
        });
    }

    private User withId(User u) {
        ReflectionTestUtils.setField(u, "id", userId);
        return u;
    }

    // ─── loadUserByUsername ──────────────────────────────────────────────────────

    @Test
    @DisplayName("loadUserByUsername throws UsernameNotFoundException for an unknown email")
    void loadUserByUsernameThrowsForUnknownEmail() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.loadUserByUsername("nobody@example.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    @DisplayName("loadUserByUsername returns a UserDetails wrapping the found user")
    void loadUserByUsernameReturnsPrincipal() {
        User user = withId(User.builder().email("a@x.com").passwordHash("hash").build());
        when(userRepository.findByEmail("a@x.com")).thenReturn(Optional.of(user));

        UserDetails result = service.loadUserByUsername("a@x.com");

        assertThat(result.getUsername()).isEqualTo("a@x.com");
    }

    // ─── updateProfile ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateProfile")
    class UpdateProfileTests {

        @Test
        @DisplayName("trims and applies a non-blank fullName")
        void trimsAndAppliesFullName() {
            User user = withId(User.builder().fullName("Old Name").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateProfileRequest req = mock(UpdateProfileRequest.class);
            when(req.getFullName()).thenReturn("  New Name  ");

            service.updateProfile(userId, req);

            assertThat(user.getFullName()).isEqualTo("New Name");
        }

        @Test
        @DisplayName("ignores a blank fullName, leaving the existing value untouched")
        void ignoresBlankFullName() {
            User user = withId(User.builder().fullName("Original").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateProfileRequest req = mock(UpdateProfileRequest.class);
            when(req.getFullName()).thenReturn("   ");

            service.updateProfile(userId, req);

            assertThat(user.getFullName()).isEqualTo("Original");
        }

        @Test
        @DisplayName("throws ResourceNotFoundException for an unknown user")
        void throwsForUnknownUser() {
            when(userRepository.findById(userId)).thenReturn(Optional.empty());
            UpdateProfileRequest req = mock(UpdateProfileRequest.class);
            assertThatThrownBy(() -> service.updateProfile(userId, req)).isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ─── changePassword ──────────────────────────────────────────────────────────

    @Nested
    @DisplayName("changePassword")
    class ChangePasswordTests {

        @Test
        @DisplayName("throws when the current password is incorrect")
        void throwsOnWrongCurrentPassword() {
            User user = withId(User.builder().passwordHash("hashed").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("wrong", "hashed")).thenReturn(false);
            ChangePasswordRequest req = mock(ChangePasswordRequest.class);
            when(req.getCurrentPassword()).thenReturn("wrong");

            assertThatThrownBy(() -> service.changePassword(userId, req, "ip", "ua")).isInstanceOf(BusinessException.class);
            verify(refreshTokenRepository, never()).revokeAllByUserId(any());
        }

        @Test
        @DisplayName("on success, updates the hash and revokes ALL sessions and outstanding access tokens")
        void successRevokesAllSessions() {
            User user = withId(User.builder().passwordHash("old-hash").build());
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(passwordEncoder.matches("OldPass1", "old-hash")).thenReturn(true);
            when(passwordEncoder.encode("NewPass1")).thenReturn("new-hash");
            ChangePasswordRequest req = mock(ChangePasswordRequest.class);
            when(req.getCurrentPassword()).thenReturn("OldPass1");
            when(req.getNewPassword()).thenReturn("NewPass1");

            service.changePassword(userId, req, "ip", "ua");

            assertThat(user.getPasswordHash()).isEqualTo("new-hash");
            verify(refreshTokenRepository).revokeAllByUserId(userId);
            verify(tokenRevocationService).revokeAllTokensFor(userId);
        }
    }

    // ─── closeAccount ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("closeAccount deactivates the user and revokes all their refresh tokens")
    void closeAccountDeactivatesAndRevokesTokens() {
        User user = withId(User.builder().active(true).build());
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        service.closeAccount(userId);

        assertThat(user.isActive()).isFalse();
        verify(refreshTokenRepository).revokeAllByUserId(userId);
    }
}
