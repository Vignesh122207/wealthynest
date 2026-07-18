package com.wealthynest.domain.admin.service;

import com.wealthynest.common.audit.AuditLogRepository;
import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.argThat;

@ExtendWith(MockitoExtension.class)
class AdminServiceImplTest {

    @Mock private UserRepository         userRepository;
    @Mock private UserMapper             userMapper;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private AuthService            authService;
    @Mock private AuditLogRepository     auditLogRepository;
    @Mock private AuditService           auditService;

    @InjectMocks
    private AdminServiceImpl service;

    private final UUID actorId  = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();

    @BeforeEach
    void stubMapperPassthrough() {
        lenient().when(userMapper.toResponse(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            return UserResponse.builder().id(u.getId()).fullName(u.getFullName()).build();
        });
    }

    private User withId(User u) {
        ReflectionTestUtils.setField(u, "id", targetId);
        return u;
    }

    // ─── toggleActive ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("toggleActive")
    class ToggleActiveTests {

        @Test
        @DisplayName("blocks an admin from deactivating their own account via the admin panel")
        void blocksSelfDeactivation() {
            assertThatThrownBy(() -> service.toggleActive(actorId, actorId, "ip", "ua"))
                    .isInstanceOf(BusinessException.class);
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("deactivating an active user revokes all their refresh tokens")
        void deactivatingRevokesTokens() {
            User user = withId(User.builder().active(true).email("a@x.com").build());
            when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            service.toggleActive(targetId, actorId, "ip", "ua");

            assertThat(user.isActive()).isFalse();
            verify(refreshTokenRepository).revokeAllByUserId(targetId);
        }

        @Test
        @DisplayName("reactivating an inactive user does NOT touch their refresh tokens")
        void reactivatingDoesNotRevokeTokens() {
            User user = withId(User.builder().active(false).email("a@x.com").build());
            when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            service.toggleActive(targetId, actorId, "ip", "ua");

            assertThat(user.isActive()).isTrue();
            verifyNoInteractions(refreshTokenRepository);
        }
    }

    // ─── updateRole ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("updateRole changes the target's role and audit-logs the before/after")
    void updateRoleChangesRole() {
        User user = withId(User.builder().role(UserRole.MEMBER).email("a@x.com").build());
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.updateRole(targetId, UserRole.ADMIN, actorId, "ip", "ua");

        assertThat(user.getRole()).isEqualTo(UserRole.ADMIN);
        verify(auditService).log(eq(actorId), eq("USER_ROLE_CHANGED"), eq("USER"), eq(targetId), any(), any(), any(), any());
    }

    // ─── resetPassword ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("resetPassword delegates to the standard forgot-password flow for the target's email")
    void resetPasswordDelegatesToForgotPassword() {
        User user = withId(User.builder().email("target@x.com").build());
        when(userRepository.findById(targetId)).thenReturn(Optional.of(user));

        String email = service.resetPassword(targetId, actorId, "ip", "ua");

        assertThat(email).isEqualTo("target@x.com");
        verify(authService).forgotPassword(argThat(req -> req.getEmail().equals("target@x.com")));
    }

    @Test
    @DisplayName("throws for an unknown target user")
    void resetPasswordThrowsForUnknownUser() {
        when(userRepository.findById(targetId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.resetPassword(targetId, actorId, "ip", "ua"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ─── anonymizeUser ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("anonymizeUser")
    class AnonymizeUserTests {

        @Test
        @DisplayName("blocks an admin from anonymizing their own account")
        void blocksSelfAnonymization() {
            assertThatThrownBy(() -> service.anonymizeUser(actorId, actorId, "ip", "ua"))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("scrubs the name/email, deactivates, and revokes all sessions")
        void scrubsAndDeactivates() {
            User user = withId(User.builder().fullName("Alice Real Name").email("alice@real.com").active(true).build());
            when(userRepository.findById(targetId)).thenReturn(Optional.of(user));
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            service.anonymizeUser(targetId, actorId, "ip", "ua");

            assertThat(user.getFullName()).isEqualTo("[Deleted User]");
            assertThat(user.getEmail()).contains("@removed.invalid").doesNotContain("alice");
            assertThat(user.isActive()).isFalse();
            verify(refreshTokenRepository).revokeAllByUserId(targetId);
        }
    }

    // ─── getStats ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getStats computes inactiveUsers as total minus active, not a separate query")
    void getStatsComputesInactiveAsDerived() {
        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countByActiveTrue()).thenReturn(80L);
        when(userRepository.countByRole(UserRole.ADMIN)).thenReturn(2L);
        when(userRepository.countByRole(UserRole.MEMBER)).thenReturn(90L);
        when(userRepository.countNewUsersInMonth(anyInt(), anyInt())).thenReturn(5L);

        var stats = service.getStats();

        assertThat(stats.get("totalUsers")).isEqualTo(100L);
        assertThat(stats.get("inactiveUsers")).isEqualTo(20L);
    }
}
