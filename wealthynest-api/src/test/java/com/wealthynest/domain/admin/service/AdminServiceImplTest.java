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

    // ─── getUserGrowth ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("getUserGrowth maps each [month, count] row into a month/count map")
    void getUserGrowthMapsRows() {
        Object[] row1 = new Object[] { "2026-06", 5L };
        Object[] row2 = new Object[] { "2026-07", 9L };
        when(userRepository.countNewUsersByMonth(any())).thenReturn(java.util.List.of(row1, row2));

        var growth = service.getUserGrowth();

        assertThat(growth).hasSize(2);
        assertThat(growth.get(0).get("month")).isEqualTo("2026-06");
        assertThat(growth.get(0).get("count")).isEqualTo(5L);
        assertThat(growth.get(1).get("count")).isEqualTo(9L);
    }

    // ─── listUsers ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("listUsers")
    class ListUsersTests {

        @Test
        @DisplayName("blank search term → uses findAll, not the search query")
        void blankSearch_usesFindAll() {
            var pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            User u = withId(User.builder().email("a@b.com").fullName("A").build());
            when(userRepository.findAll(pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of(u)));

            var result = service.listUsers(pageable, "  ");

            assertThat(result.getData()).hasSize(1);
            verify(userRepository, never()).search(anyString(), any());
        }

        @Test
        @DisplayName("non-blank search term → uses the search query, trimmed")
        void nonBlankSearch_usesSearchQuery() {
            var pageable = org.springframework.data.domain.PageRequest.of(0, 10);
            User u = withId(User.builder().email("alice@b.com").fullName("Alice").build());
            when(userRepository.search("alice", pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of(u)));

            var result = service.listUsers(pageable, "  alice  ");

            assertThat(result.getData()).hasSize(1);
            verify(userRepository, never()).findAll(any(org.springframework.data.domain.Pageable.class));
        }
    }

    // ─── getAuditLogs ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getAuditLogs")
    class GetAuditLogsTests {

        private final org.springframework.data.domain.Pageable pageable =
            org.springframework.data.domain.PageRequest.of(0, 10);

        @Test
        @DisplayName("no filters → uses findAllByOrderByCreatedAtDesc")
        void noFilters_usesUnfilteredQuery() {
            when(auditLogRepository.findAllByOrderByCreatedAtDesc(pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of()));

            var result = service.getAuditLogs(pageable, null, null);

            assertThat(result.getData()).isEmpty();
            verify(auditLogRepository, never()).findWithFilters(any(), any(), any());
        }

        @Test
        @DisplayName("userId or action filter present → uses findWithFilters")
        void withFilter_usesFilteredQuery() {
            when(auditLogRepository.findWithFilters(eq(targetId), eq("USER_DEACTIVATED"), eq(pageable)))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of()));

            service.getAuditLogs(pageable, targetId, "USER_DEACTIVATED");

            verify(auditLogRepository).findWithFilters(targetId, "USER_DEACTIVATED", pageable);
            verify(auditLogRepository, never()).findAllByOrderByCreatedAtDesc(any());
        }

        @Test
        @DisplayName("log with null userId → response userEmail is \"system\"")
        void nullUserId_mapsToSystem() {
            var log = com.wealthynest.common.audit.AuditLog.builder()
                .action("SCHEDULED_JOB").build();
            when(auditLogRepository.findAllByOrderByCreatedAtDesc(pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of(log)));

            var result = service.getAuditLogs(pageable, null, null);

            assertThat(result.getData().get(0).getUserEmail()).isEqualTo("system");
            verifyNoInteractions(userRepository);
        }

        @Test
        @DisplayName("log with known userId → response userEmail resolved from userRepository")
        void knownUserId_resolvesEmail() {
            var log = com.wealthynest.common.audit.AuditLog.builder()
                .userId(targetId).action("USER_ROLE_CHANGED").build();
            User u = withId(User.builder().email("alice@b.com").build());
            when(auditLogRepository.findAllByOrderByCreatedAtDesc(pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of(log)));
            when(userRepository.findAllById(java.util.List.of(targetId))).thenReturn(java.util.List.of(u));

            var result = service.getAuditLogs(pageable, null, null);

            assertThat(result.getData().get(0).getUserEmail()).isEqualTo("alice@b.com");
        }

        @Test
        @DisplayName("log with unknown userId (user deleted since) → response userEmail is \"unknown\"")
        void unknownUserId_mapsToUnknown() {
            UUID deletedUserId = UUID.randomUUID();
            var log = com.wealthynest.common.audit.AuditLog.builder()
                .userId(deletedUserId).action("USER_ROLE_CHANGED").build();
            when(auditLogRepository.findAllByOrderByCreatedAtDesc(pageable))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(java.util.List.of(log)));
            when(userRepository.findAllById(java.util.List.of(deletedUserId))).thenReturn(java.util.List.of());

            var result = service.getAuditLogs(pageable, null, null);

            assertThat(result.getData().get(0).getUserEmail()).isEqualTo("unknown");
        }
    }
}
