package com.wealthynest.domain.family.service;

import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.repository.CategoryRepository;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FamilyServiceImpl implements FamilyService {
    private final FamilyRepository    familyRepository;
    private final UserRepository      userRepository;
    private final FamilyMapper        familyMapper;
    private final AssetRepository     assetRepository;
    private final LiabilityRepository liabilityRepository;
    private final ExpenseRepository   expenseRepository;
    private final BudgetRepository    budgetRepository;
    private final CategoryRepository  categoryRepository;
    private final EntityManager       entityManager;
    private final AuditService        auditService;

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true) // migrateExistingData changes category scoping
    public FamilyResponse createFamily(UUID userId, CreateFamilyRequest request, String ipAddress, String userAgent) {
        User user = requireUser(userId);
        if (user.getFamilyId() != null) {
            throw new BusinessException("User already belongs to a family", HttpStatus.CONFLICT);
        }
        Family family = familyRepository.save(Family.builder()
                .name(request.getName())
                .inviteCode(generateUniqueInviteCode())
                .build());
        user.setFamilyId(family.getId());
        if (user.getRole() != UserRole.ADMIN) {
            user.setRole(UserRole.FAMILY_ADMIN);
        }
        userRepository.save(user);
        entityManager.flush(); // ensure family INSERT reaches DB before FK-referencing UPDATE queries
        migrateExistingData(userId, family.getId());
        log.info("Family created: {} by user: {}", family.getId(), userId);
        auditService.log(userId, "FAMILY_CREATED", "FAMILY", family.getId(),
                null, Map.of("name", family.getName()), ipAddress, userAgent);
        return familyMapper.toResponse(family);
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true) // migrateExistingData changes category scoping
    public FamilyResponse joinFamily(UUID userId, JoinFamilyRequest request) {
        User user = requireUser(userId);
        if (user.getFamilyId() != null) {
            throw new BusinessException("User already belongs to a family", HttpStatus.CONFLICT);
        }
        Family family = familyRepository.findByInviteCode(request.getInviteCode())
                .orElseThrow(() -> new ResourceNotFoundException("Family", "inviteCode", request.getInviteCode()));
        long memberCount = userRepository.countByFamilyId(family.getId());
        if (memberCount >= 6) {
            throw new BusinessException("This family group is full (max 6 members)", HttpStatus.CONFLICT);
        }
        user.setFamilyId(family.getId());
        userRepository.save(user);
        entityManager.flush();
        migrateExistingData(userId, family.getId());
        return familyMapper.toResponse(family);
    }

    @Override
    @Transactional(readOnly = true)
    public FamilyResponse getFamily(UUID userId, UUID familyId) {
        User user = requireUser(userId);
        if (!familyId.equals(user.getFamilyId())) {
            throw new BusinessException("Not a member of this family", HttpStatus.FORBIDDEN);
        }
        return familyMapper.toResponse(requireFamily(familyId));
    }

    @Override
    @Transactional
    public FamilyResponse renameFamily(UUID familyId, UUID userId, RenameFamilyRequest request) {
        User user = requireUser(userId);
        if (!familyId.equals(user.getFamilyId())) {
            throw new BusinessException("Not a member of this family", HttpStatus.FORBIDDEN);
        }
        if (user.getRole() != UserRole.FAMILY_ADMIN && user.getRole() != UserRole.ADMIN) {
            throw new BusinessException("Only the family admin can rename the group", HttpStatus.FORBIDDEN);
        }
        Family family = requireFamily(familyId);
        family.setName(request.getName());
        return familyMapper.toResponse(familyRepository.save(family));
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true) // detachExistingData changes category scoping
    public void leaveFamily(UUID userId) {
        User user = requireUser(userId);
        if (user.getFamilyId() == null) {
            throw new BusinessException("User is not in a family", HttpStatus.BAD_REQUEST);
        }
        UUID familyId = user.getFamilyId();
        boolean lastMember = false;
        if (user.getRole() == UserRole.FAMILY_ADMIN || user.getRole() == UserRole.ADMIN) {
            List<User> others = userRepository.findByFamilyId(familyId)
                    .stream().filter(u -> !u.getId().equals(userId)).toList();
            if (!others.isEmpty()) {
                boolean anotherAdminExists = others.stream()
                        .anyMatch(u -> u.getRole() == UserRole.FAMILY_ADMIN || u.getRole() == UserRole.ADMIN);
                if (!anotherAdminExists) {
                    throw new BusinessException("Promote another member to admin before leaving.", HttpStatus.CONFLICT);
                }
            } else {
                lastMember = true;
            }
        }
        // Revert this member's data to personal so it leaves the family's shared views.
        // For the last member this must happen before the family row is deleted — see detachExistingData.
        detachExistingData(userId, familyId);
        if (lastMember) {
            familyRepository.deleteById(familyId);
        }
        user.setFamilyId(null);
        if (user.getRole() != UserRole.ADMIN) {
            user.setRole(UserRole.MEMBER);
        }
        userRepository.save(user);
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true) // clearFamilyId changes category scoping
    public void deleteFamily(UUID familyId, UUID userId, String ipAddress, String userAgent) {
        User user = requireUser(userId);
        if (!familyId.equals(user.getFamilyId()) ||
                (user.getRole() != UserRole.FAMILY_ADMIN && user.getRole() != UserRole.ADMIN)) {
            throw new BusinessException("Only the family admin can delete the group", HttpStatus.FORBIDDEN);
        }
        Family family = requireFamily(familyId);
        // Clear FK references on all data tables first
        assetRepository.clearFamilyId(familyId);
        liabilityRepository.clearFamilyId(familyId);
        expenseRepository.clearFamilyId(familyId);
        budgetRepository.clearFamilyId(familyId);
        categoryRepository.clearFamilyId(familyId);

        // Detach all members
        userRepository.findByFamilyId(familyId).forEach(member -> {
            member.setFamilyId(null);
            if (member.getRole() != UserRole.ADMIN) {
                member.setRole(UserRole.MEMBER);
            }
            userRepository.save(member);
        });
        familyRepository.deleteById(familyId);
        log.info("Family {} deleted by admin {}", familyId, userId);
        auditService.log(userId, "FAMILY_DELETED", "FAMILY", familyId,
                Map.of("name", family.getName()), null, ipAddress, userAgent);
    }

    @Override
    @Transactional(readOnly = true)
    public List<FamilyMemberResponse> getMembers(UUID userId, UUID familyId) {
        User user = requireUser(userId);
        if (!familyId.equals(user.getFamilyId())) {
            throw new BusinessException("Not a member of this family", HttpStatus.FORBIDDEN);
        }
        return userRepository.findByFamilyId(familyId).stream()
                .map(u -> FamilyMemberResponse.builder()
                        .id(u.getId())
                        .fullName(u.getFullName())
                        .email(u.getEmail())
                        .role(u.getRole().name())
                        .build())
                .toList();
    }

    @Override
    @Transactional
    @CacheEvict(value = "categories", allEntries = true) // detachExistingData changes category scoping
    public void removeMember(UUID familyId, UUID adminId, UUID memberId) {
        User admin = requireUser(adminId);
        if (!familyId.equals(admin.getFamilyId()) ||
                (admin.getRole() != UserRole.FAMILY_ADMIN && admin.getRole() != UserRole.ADMIN)) {
            throw new BusinessException("Only the family admin can remove members", HttpStatus.FORBIDDEN);
        }
        if (adminId.equals(memberId)) {
            throw new BusinessException("Admin cannot remove themselves. Use leave or delete instead.", HttpStatus.BAD_REQUEST);
        }
        User member = requireUser(memberId);
        if (!familyId.equals(member.getFamilyId())) {
            throw new BusinessException("User is not a member of this family", HttpStatus.BAD_REQUEST);
        }
        // Revert the removed member's data to personal so it leaves the family's shared views
        detachExistingData(memberId, familyId);
        member.setFamilyId(null);
        member.setRole(UserRole.MEMBER);
        userRepository.save(member);
        log.info("Member {} removed from family {} by admin {}", memberId, familyId, adminId);
    }

    @Override
    @Transactional
    public void transferAdmin(UUID familyId, UUID adminId, UUID newAdminId, String ipAddress, String userAgent) {
        User admin = requireUser(adminId);
        if (!familyId.equals(admin.getFamilyId()) ||
                (admin.getRole() != UserRole.FAMILY_ADMIN && admin.getRole() != UserRole.ADMIN)) {
            throw new BusinessException("Only the family admin can transfer admin rights", HttpStatus.FORBIDDEN);
        }
        if (adminId.equals(newAdminId)) {
            throw new BusinessException("You are already the admin", HttpStatus.BAD_REQUEST);
        }
        User newAdmin = requireUser(newAdminId);
        if (!familyId.equals(newAdmin.getFamilyId())) {
            throw new BusinessException("User is not a member of this family", HttpStatus.BAD_REQUEST);
        }
        // Promote: current admin keeps their role, new member gains FAMILY_ADMIN
        if (newAdmin.getRole() != UserRole.ADMIN) {
            newAdmin.setRole(UserRole.FAMILY_ADMIN);
        }
        userRepository.save(newAdmin);
        log.info("Admin promoted in family {}: {} granted admin to {}", familyId, adminId, newAdminId);
        auditService.log(adminId, "FAMILY_ADMIN_TRANSFERRED", "FAMILY", familyId,
                Map.of("previousAdmin", adminId.toString()),
                Map.of("newAdmin", newAdminId.toString()), ipAddress, userAgent);
    }

    @Override
    @Transactional
    public void revokeAdmin(UUID familyId, UUID adminId, UUID targetId, String ipAddress, String userAgent) {
        User admin = requireUser(adminId);
        if (!familyId.equals(admin.getFamilyId()) ||
                (admin.getRole() != UserRole.FAMILY_ADMIN && admin.getRole() != UserRole.ADMIN)) {
            throw new BusinessException("Only a family admin can revoke admin rights", HttpStatus.FORBIDDEN);
        }
        if (adminId.equals(targetId)) {
            throw new BusinessException("You cannot revoke your own admin rights", HttpStatus.BAD_REQUEST);
        }
        User target = requireUser(targetId);
        if (!familyId.equals(target.getFamilyId())) {
            throw new BusinessException("User is not a member of this family", HttpStatus.BAD_REQUEST);
        }
        if (target.getRole() == UserRole.ADMIN) {
            throw new BusinessException("Cannot revoke app-level admin rights", HttpStatus.FORBIDDEN);
        }
        String previousRole = target.getRole().name();
        target.setRole(UserRole.MEMBER);
        userRepository.save(target);
        log.info("Admin revoked in family {}: {} revoked admin from {}", familyId, adminId, targetId);
        auditService.log(adminId, "FAMILY_ADMIN_REVOKED", "FAMILY", familyId,
                Map.of("targetUserId", targetId.toString(), "role", previousRole),
                Map.of("targetUserId", targetId.toString(), "role", "MEMBER"), ipAddress, userAgent);
    }

    private void migrateExistingData(UUID userId, UUID familyId) {
        assetRepository.migrateUserAssetsToFamily(familyId, userId);
        liabilityRepository.migrateUserLiabilitiesToFamily(familyId, userId);
        expenseRepository.migrateUserExpensesToFamily(familyId, userId);
        budgetRepository.migrateUserBudgetsToFamily(familyId, userId);
        categoryRepository.migrateUserCategoriesToFamily(familyId, userId);
        log.info("Migrated existing data for user {} to family {}", userId, familyId);
    }

    /**
     * Reverse of migrateExistingData — reverts a departing member's own data to personal so it
     * stops appearing in the family's shared views (categories, expenses, budgets, assets,
     * liabilities). Must run BEFORE any family-row deletion: categories/budgets carry
     * ON DELETE CASCADE on family_id, so deleting the family first would destroy the data.
     */
    private void detachExistingData(UUID userId, UUID familyId) {
        assetRepository.clearFamilyIdForUser(userId, familyId);
        liabilityRepository.clearFamilyIdForUser(userId, familyId);
        expenseRepository.clearFamilyIdForUser(userId, familyId);
        budgetRepository.clearFamilyIdForUser(userId, familyId);
        categoryRepository.clearFamilyIdForUser(userId, familyId);
        log.info("Detached data of user {} from family {}", userId, familyId);
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }

    private Family requireFamily(UUID familyId) {
        return familyRepository.findById(familyId)
                .orElseThrow(() -> new ResourceNotFoundException("Family", "id", familyId));
    }

    private String generateUniqueInviteCode() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[12];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes).substring(0, 8).toUpperCase();
        return familyRepository.existsByInviteCode(code) ? generateUniqueInviteCode() : code;
    }
}
