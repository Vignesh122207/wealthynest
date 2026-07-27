package com.wealthynest.domain.family.service;

import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.goal.repository.GoalRepository;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.family.dto.request.CreateFamilyRequest;
import com.wealthynest.domain.family.dto.request.JoinFamilyRequest;
import com.wealthynest.domain.family.dto.request.RenameFamilyRequest;
import com.wealthynest.domain.family.dto.response.FamilyMemberResponse;
import com.wealthynest.domain.family.dto.response.FamilyResponse;
import com.wealthynest.domain.family.entity.Family;
import com.wealthynest.domain.family.mapper.FamilyMapper;
import com.wealthynest.domain.family.repository.FamilyRepository;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.domain.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FamilyServiceImplTest {

    @Mock private FamilyRepository    familyRepository;
    @Mock private UserRepository      userRepository;
    @Mock private FamilyMapper        familyMapper;
    @Mock private AssetRepository     assetRepository;
    @Mock private LiabilityRepository liabilityRepository;
    @Mock private ExpenseRepository   expenseRepository;
    @Mock private BudgetRepository    budgetRepository;
    @Mock private CategoryRepository  categoryRepository;
    @Mock private GoalRepository      goalRepository;
    @Mock private EntityManager       entityManager;
    @Mock private AuditService        auditService;

    @InjectMocks
    private FamilyServiceImpl service;

    private final UUID userId   = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();
    private final String ip = "127.0.0.1";
    private final String ua = "JUnit";

    @BeforeEach
    void stubMapperPassthrough() {
        lenient().when(familyMapper.toResponse(any(Family.class))).thenAnswer(inv -> {
            Family f = inv.getArgument(0);
            return FamilyResponse.builder().id(f.getId()).name(f.getName()).build();
        });
    }

    private User withId(User u, UUID id) {
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    private Family withFamilyId(Family f) {
        ReflectionTestUtils.setField(f, "id", familyId);
        return f;
    }

    // ─── createFamily ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createFamily")
    class CreateFamilyTests {

        @Test
        @DisplayName("throws when the user already belongs to a family")
        void throwsWhenAlreadyInFamily() {
            User user = withId(User.builder().familyId(UUID.randomUUID()).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            CreateFamilyRequest req = mock(CreateFamilyRequest.class);

            assertThatThrownBy(() -> service.createFamily(userId, req, ip, ua)).isInstanceOf(BusinessException.class);
            verify(familyRepository, never()).save(any());
        }

        @Test
        @DisplayName("promotes a MEMBER to FAMILY_ADMIN on creation")
        void promotesMemberToFamilyAdmin() {
            User user = withId(User.builder().familyId(null).role(UserRole.MEMBER).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(familyRepository.save(any(Family.class))).thenAnswer(inv -> withFamilyId(inv.getArgument(0)));
            when(familyRepository.existsByInviteCode(any())).thenReturn(false);
            CreateFamilyRequest req = mock(CreateFamilyRequest.class);
            when(req.getName()).thenReturn("The Smiths");

            service.createFamily(userId, req, ip, ua);

            assertThat(user.getRole()).isEqualTo(UserRole.FAMILY_ADMIN);
            assertThat(user.getFamilyId()).isEqualTo(familyId);
        }

        @Test
        @DisplayName("an app-level ADMIN keeps their ADMIN role rather than being downgraded to FAMILY_ADMIN")
        void appAdminKeepsAdminRole() {
            User user = withId(User.builder().familyId(null).role(UserRole.ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(familyRepository.save(any(Family.class))).thenAnswer(inv -> withFamilyId(inv.getArgument(0)));
            when(familyRepository.existsByInviteCode(any())).thenReturn(false);
            CreateFamilyRequest req = mock(CreateFamilyRequest.class);
            when(req.getName()).thenReturn("The Smiths");

            service.createFamily(userId, req, ip, ua);

            assertThat(user.getRole()).isEqualTo(UserRole.ADMIN);
        }

        @Test
        @DisplayName("migrates the creator's existing personal data into the new family")
        void migratesExistingDataOnCreate() {
            User user = withId(User.builder().familyId(null).role(UserRole.MEMBER).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(familyRepository.save(any(Family.class))).thenAnswer(inv -> withFamilyId(inv.getArgument(0)));
            when(familyRepository.existsByInviteCode(any())).thenReturn(false);
            CreateFamilyRequest req = mock(CreateFamilyRequest.class);
            when(req.getName()).thenReturn("The Smiths");

            service.createFamily(userId, req, ip, ua);

            verify(assetRepository).migrateUserAssetsToFamily(familyId, userId);
            verify(expenseRepository).migrateUserExpensesToFamily(familyId, userId);
            verify(categoryRepository).migrateUserCategoriesToFamily(familyId, userId);
            verify(goalRepository).migrateUserGoalsToFamily(familyId, userId);
        }
    }

    // ─── joinFamily ──────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("joinFamily")
    class JoinFamilyTests {

        @Test
        @DisplayName("throws when the user already belongs to a family")
        void throwsWhenAlreadyInFamily() {
            User user = withId(User.builder().familyId(UUID.randomUUID()).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            JoinFamilyRequest req = mock(JoinFamilyRequest.class);
            assertThatThrownBy(() -> service.joinFamily(userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws ResourceNotFoundException for an unknown invite code")
        void throwsForUnknownInviteCode() {
            User user = withId(User.builder().familyId(null).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(familyRepository.findByInviteCode("BOGUS")).thenReturn(Optional.empty());
            JoinFamilyRequest req = mock(JoinFamilyRequest.class);
            when(req.getInviteCode()).thenReturn("BOGUS");
            assertThatThrownBy(() -> service.joinFamily(userId, req)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws when the family already has 6 members (max size)")
        void throwsWhenFamilyFull() {
            User user = withId(User.builder().familyId(null).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            Family family = withFamilyId(Family.builder().inviteCode("ABC12345").build());
            when(familyRepository.findByInviteCode("ABC12345")).thenReturn(Optional.of(family));
            when(userRepository.countByFamilyId(familyId)).thenReturn(6L);
            JoinFamilyRequest req = mock(JoinFamilyRequest.class);
            when(req.getInviteCode()).thenReturn("ABC12345");

            assertThatThrownBy(() -> service.joinFamily(userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, sets the joiner's familyId and migrates their existing data")
        void successSetsFamilyIdAndMigratesData() {
            User user = withId(User.builder().familyId(null).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            Family family = withFamilyId(Family.builder().inviteCode("ABC12345").build());
            when(familyRepository.findByInviteCode("ABC12345")).thenReturn(Optional.of(family));
            when(userRepository.countByFamilyId(familyId)).thenReturn(2L);
            JoinFamilyRequest req = mock(JoinFamilyRequest.class);
            when(req.getInviteCode()).thenReturn("ABC12345");

            service.joinFamily(userId, req);

            assertThat(user.getFamilyId()).isEqualTo(familyId);
            verify(assetRepository).migrateUserAssetsToFamily(familyId, userId);
        }
    }

    // ─── getFamily / getMembers: membership guard ───────────────────────────────

    @Nested
    @DisplayName("getFamily / getMembers: membership guard")
    class MembershipGuardTests {

        @Test
        @DisplayName("getFamily throws FORBIDDEN when the caller isn't a member of the requested family")
        void getFamilyThrowsForNonMember() {
            User user = withId(User.builder().familyId(UUID.randomUUID()).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            assertThatThrownBy(() -> service.getFamily(userId, familyId)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("getMembers throws FORBIDDEN when the caller isn't a member of the requested family")
        void getMembersThrowsForNonMember() {
            User user = withId(User.builder().familyId(null).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            assertThatThrownBy(() -> service.getMembers(userId, familyId)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("getMembers succeeds and maps each member's role/name/email for an actual member")
        void getMembersSucceedsForMember() {
            User user = withId(User.builder().familyId(familyId).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            User member = User.builder().familyId(familyId).fullName("Alice").email("a@x.com").role(UserRole.MEMBER).build();
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(member));

            List<FamilyMemberResponse> result = service.getMembers(userId, familyId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getFullName()).isEqualTo("Alice");
        }
    }

    // ─── renameFamily ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("renameFamily")
    class RenameFamilyTests {

        @Test
        @DisplayName("throws when only a plain MEMBER (not an admin) tries to rename")
        void throwsForNonAdminMember() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            RenameFamilyRequest req = mock(RenameFamilyRequest.class);
            assertThatThrownBy(() -> service.renameFamily(familyId, userId, req)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("FAMILY_ADMIN can rename the group")
        void familyAdminCanRename() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            Family family = withFamilyId(Family.builder().name("Old Name").build());
            when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
            when(familyRepository.save(any(Family.class))).thenAnswer(inv -> inv.getArgument(0));
            RenameFamilyRequest req = mock(RenameFamilyRequest.class);
            when(req.getName()).thenReturn("New Name");

            service.renameFamily(familyId, userId, req);

            assertThat(family.getName()).isEqualTo("New Name");
        }
    }

    // ─── leaveFamily ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("leaveFamily")
    class LeaveFamilyTests {

        @Test
        @DisplayName("throws when the user isn't in a family")
        void throwsWhenNotInFamily() {
            User user = withId(User.builder().familyId(null).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            assertThatThrownBy(() -> service.leaveFamily(userId)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("a FAMILY_ADMIN with other members but no other admin must promote someone first")
        void blocksSoleAdminFromLeavingWithoutSuccessor() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            User otherMember = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), UUID.randomUUID());
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(user, otherMember));

            assertThatThrownBy(() -> service.leaveFamily(userId)).isInstanceOf(BusinessException.class);
            verify(familyRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("a FAMILY_ADMIN can leave when another admin already exists")
        void allowsAdminToLeaveWhenSuccessorExists() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            User otherAdmin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), UUID.randomUUID());
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(user, otherAdmin));

            service.leaveFamily(userId);

            assertThat(user.getFamilyId()).isNull();
            assertThat(user.getRole()).isEqualTo(UserRole.MEMBER);
            verify(familyRepository, never()).deleteById(any());
        }

        @Test
        @DisplayName("the last member leaving deletes the family, and data is detached BEFORE that deletion")
        void lastMemberLeavingDeletesFamilyAfterDetaching() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(user)); // only member

            service.leaveFamily(userId);

            InOrder order = inOrder(assetRepository, familyRepository);
            order.verify(assetRepository).clearFamilyIdForUser(userId, familyId);
            order.verify(familyRepository).deleteById(familyId);
        }

        @Test
        @DisplayName("a plain MEMBER can always leave without any admin-succession check")
        void plainMemberLeavesFreely() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));

            service.leaveFamily(userId);

            assertThat(user.getFamilyId()).isNull();
            verifyNoInteractions(familyRepository); // never even checks membership count
        }

        @Test
        @DisplayName("an app-level ADMIN's role is preserved (not downgraded to MEMBER) after leaving")
        void appAdminRolePreservedAfterLeaving() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(user));

            service.leaveFamily(userId);

            assertThat(user.getRole()).isEqualTo(UserRole.ADMIN);
        }
    }

    // ─── deleteFamily ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteFamily")
    class DeleteFamilyTests {

        @Test
        @DisplayName("throws when the caller isn't an admin of that family")
        void throwsForNonAdmin() {
            User user = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(user));
            assertThatThrownBy(() -> service.deleteFamily(familyId, userId, ip, ua)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("clears FK references, detaches every member, then deletes the family")
        void clearsDataAndDetachesAllMembers() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            Family family = withFamilyId(Family.builder().name("The Smiths").build());
            when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
            User member1 = User.builder().familyId(familyId).role(UserRole.MEMBER).build();
            User member2 = User.builder().familyId(familyId).role(UserRole.ADMIN).build(); // app-admin member
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(member1, member2));

            service.deleteFamily(familyId, userId, ip, ua);

            verify(assetRepository).clearFamilyId(familyId);
            verify(categoryRepository).clearFamilyId(familyId);
            verify(goalRepository).clearFamilyId(familyId);
            assertThat(member1.getFamilyId()).isNull();
            assertThat(member1.getRole()).isEqualTo(UserRole.MEMBER);
            assertThat(member2.getRole()).isEqualTo(UserRole.ADMIN); // app-admin preserved
            verify(familyRepository).deleteById(familyId);
        }
    }

    // ─── removeMember ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("removeMember")
    class RemoveMemberTests {

        @Test
        @DisplayName("throws when the caller isn't an admin")
        void throwsForNonAdminCaller() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            assertThatThrownBy(() -> service.removeMember(familyId, userId, UUID.randomUUID()))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the admin tries to remove themselves")
        void throwsWhenRemovingSelf() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            assertThatThrownBy(() -> service.removeMember(familyId, userId, userId)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the target isn't a member of this family")
        void throwsWhenTargetNotInFamily() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            UUID targetId = UUID.randomUUID();
            User target = withId(User.builder().familyId(UUID.randomUUID()).build(), targetId);
            when(userRepository.findById(targetId)).thenReturn(Optional.of(target));

            assertThatThrownBy(() -> service.removeMember(familyId, userId, targetId)).isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("on success, detaches the member's data and resets their role/familyId")
        void successDetachesAndResetsMember() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            UUID targetId = UUID.randomUUID();
            User target = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), targetId);
            when(userRepository.findById(targetId)).thenReturn(Optional.of(target));

            service.removeMember(familyId, userId, targetId);

            assertThat(target.getFamilyId()).isNull();
            assertThat(target.getRole()).isEqualTo(UserRole.MEMBER);
            verify(assetRepository).clearFamilyIdForUser(targetId, familyId);
            verify(goalRepository).clearFamilyIdForUser(targetId, familyId);
        }
    }

    // ─── transferAdmin ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("transferAdmin")
    class TransferAdminTests {

        @Test
        @DisplayName("throws when transferring to yourself")
        void throwsWhenTransferringToSelf() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            assertThatThrownBy(() -> service.transferAdmin(familyId, userId, userId, ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("promotes the target to FAMILY_ADMIN while the original admin KEEPS their own admin role (adds, doesn't replace)")
        void promotesTargetWithoutDemotingOriginalAdmin() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            UUID newAdminId = UUID.randomUUID();
            User newAdmin = withId(User.builder().familyId(familyId).role(UserRole.MEMBER).build(), newAdminId);
            when(userRepository.findById(newAdminId)).thenReturn(Optional.of(newAdmin));

            service.transferAdmin(familyId, userId, newAdminId, ip, ua);

            assertThat(newAdmin.getRole()).isEqualTo(UserRole.FAMILY_ADMIN);
            assertThat(admin.getRole()).isEqualTo(UserRole.FAMILY_ADMIN); // unchanged, still an admin too
        }
    }

    // ─── revokeAdmin ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("revokeAdmin")
    class RevokeAdminTests {

        @Test
        @DisplayName("throws when trying to revoke your own admin rights")
        void throwsWhenRevokingSelf() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            assertThatThrownBy(() -> service.revokeAdmin(familyId, userId, userId, ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when trying to revoke an app-level ADMIN's rights")
        void throwsWhenRevokingAppAdmin() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            UUID targetId = UUID.randomUUID();
            User target = withId(User.builder().familyId(familyId).role(UserRole.ADMIN).build(), targetId);
            when(userRepository.findById(targetId)).thenReturn(Optional.of(target));

            assertThatThrownBy(() -> service.revokeAdmin(familyId, userId, targetId, ip, ua))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("downgrades a FAMILY_ADMIN target to MEMBER")
        void downgradesFamilyAdminToMember() {
            User admin = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), userId);
            when(userRepository.findById(userId)).thenReturn(Optional.of(admin));
            UUID targetId = UUID.randomUUID();
            User target = withId(User.builder().familyId(familyId).role(UserRole.FAMILY_ADMIN).build(), targetId);
            when(userRepository.findById(targetId)).thenReturn(Optional.of(target));

            service.revokeAdmin(familyId, userId, targetId, ip, ua);

            assertThat(target.getRole()).isEqualTo(UserRole.MEMBER);
        }
    }
}
