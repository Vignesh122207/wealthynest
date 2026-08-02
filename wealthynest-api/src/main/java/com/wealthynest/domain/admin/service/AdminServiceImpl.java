package com.wealthynest.domain.admin.service;

import com.wealthynest.common.audit.AuditLogRepository;
import com.wealthynest.common.audit.AuditLogResponse;
import com.wealthynest.common.audit.AuditService;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.common.response.PagedResponse;
import com.wealthynest.domain.account.repository.AccountTransferRepository;
import com.wealthynest.domain.asset.repository.AssetRepository;
import com.wealthynest.domain.auth.dto.request.ForgotPasswordRequest;
import com.wealthynest.domain.auth.repository.RefreshTokenRepository;
import com.wealthynest.domain.auth.repository.WebAuthnCredentialRepository;
import com.wealthynest.domain.auth.service.AuthService;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expensesplit.repository.ExpenseSplitRepository;
import com.wealthynest.domain.investment.repository.InvestmentIncomeLogRepository;
import com.wealthynest.domain.liability.repository.LiabilityRepository;
import com.wealthynest.domain.support.entity.SupportTicket;
import com.wealthynest.domain.support.repository.SupportTicketRepository;
import com.wealthynest.domain.user.dto.response.UserResponse;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.entity.UserRole;
import com.wealthynest.domain.user.mapper.UserMapper;
import com.wealthynest.domain.user.repository.UserRepository;
import com.wealthynest.domain.vault.repository.VaultItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminServiceImpl implements AdminService {

    private final UserRepository                userRepository;
    private final UserMapper                    userMapper;
    private final RefreshTokenRepository        refreshTokenRepository;
    private final AuthService                   authService;
    private final AuditLogRepository            auditLogRepository;
    private final AuditService                  auditService;
    private final VaultItemRepository           vaultItemRepository;
    private final WebAuthnCredentialRepository  webAuthnCredentialRepository;
    private final AssetRepository               assetRepository;
    private final LiabilityRepository           liabilityRepository;
    private final ExpenseRepository             expenseRepository;
    private final ExpenseSplitRepository        expenseSplitRepository;
    private final InvestmentIncomeLogRepository investmentIncomeLogRepository;
    private final AccountTransferRepository     accountTransferRepository;
    private final SupportTicketRepository       supportTicketRepository;

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> getStats() {
        long total    = userRepository.count();
        long active   = userRepository.countByActiveTrue();
        long admins   = userRepository.countByRole(UserRole.ADMIN);
        long members  = userRepository.countByRole(UserRole.MEMBER);
        LocalDate now = LocalDate.now();
        long newThisMonth = userRepository.countNewUsersInMonth(now.getYear(), now.getMonthValue());
        Map<String, Long> stats = new LinkedHashMap<>();
        stats.put("totalUsers",        total);
        stats.put("activeUsers",       active);
        stats.put("inactiveUsers",     total - active);
        stats.put("adminUsers",        admins);
        stats.put("memberUsers",       members);
        stats.put("newUsersThisMonth", newThisMonth);
        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserGrowth() {
        Instant startDate = LocalDate.now().minusMonths(11).withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        List<Object[]> rows = userRepository.countNewUsersByMonth(startDate);
        return rows.stream()
                .map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("month", r[0].toString());
                    m.put("count", ((Number) r[1]).longValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<UserResponse> listUsers(Pageable pageable, String search) {
        Page<UserResponse> result = StringUtils.hasText(search)
                ? userRepository.search(search.trim(), pageable).map(userMapper::toResponse)
                : userRepository.findAll(pageable).map(userMapper::toResponse);
        return PagedResponse.of(result);
    }

    @Override
    @Transactional
    public UserResponse toggleActive(UUID targetId, UUID actorId, String ipAddress, String userAgent) {
        requireNotSelf(targetId, actorId, "deactivate or reactivate");
        User user = requireUser(targetId);
        boolean deactivating = user.isActive();
        String  targetEmail  = user.getEmail();
        user.setActive(!deactivating);
        UserResponse saved = userMapper.toResponse(userRepository.save(user));
        if (deactivating) {
            refreshTokenRepository.revokeAllByUserId(targetId);
        }
        auditService.log(
                actorId,
                deactivating ? "USER_DEACTIVATED" : "USER_ACTIVATED",
                "USER", targetId,
                Map.of("active", deactivating,  "email", targetEmail),
                Map.of("active", !deactivating, "email", targetEmail),
                ipAddress, userAgent
        );
        return saved;
    }

    @Override
    @Transactional
    public UserResponse updateRole(UUID targetId, UserRole role, UUID actorId, String ipAddress, String userAgent) {
        User user = requireUser(targetId);
        String previousRole = user.getRole().name();
        String targetEmail  = user.getEmail();
        user.setRole(role);
        UserResponse saved = userMapper.toResponse(userRepository.save(user));
        auditService.log(
                actorId, "USER_ROLE_CHANGED", "USER", targetId,
                Map.of("role", previousRole, "email", targetEmail),
                Map.of("role", role.name(),  "email", targetEmail),
                ipAddress, userAgent
        );
        return saved;
    }

    @Override
    @Transactional
    public String resetPassword(UUID targetId, UUID actorId, String ipAddress, String userAgent) {
        String email = requireUser(targetId).getEmail();
        ForgotPasswordRequest req = new ForgotPasswordRequest();
        req.setEmail(email);
        authService.forgotPassword(req);
        auditService.log(
                actorId, "USER_PASSWORD_RESET_FORCED", "USER", targetId,
                null, Map.of("email", email),
                ipAddress, userAgent
        );
        return email;
    }

    @Override
    @Transactional
    public UserResponse anonymizeUser(UUID targetId, UUID actorId, String ipAddress, String userAgent) {
        requireNotSelf(targetId, actorId, "anonymize");
        User user = requireUser(targetId);
        String previousEmail = user.getEmail();
        user.setFullName("[Deleted User]");
        user.setEmail("deleted-" + targetId.toString().substring(0, 8) + "@removed.invalid");
        user.setActive(false);
        // Wipe local-auth credentials and stored secrets outright rather than leaving them
        // orphaned-but-intact on an anonymized identity — name/email are bookkeeping, these are
        // actual credentials/secrets, and "anonymized" should mean nobody can use them again.
        // Financial ledger data (accounts, transactions, investments, etc.) deliberately stays —
        // that's audit/compliance-retained, not personally-identifying once name/email are gone.
        user.setPinHash(null);
        user.setPinEnabledAt(null);
        vaultItemRepository.deleteByUserId(targetId);
        webAuthnCredentialRepository.deleteByUserId(targetId);
        refreshTokenRepository.revokeAllByUserId(targetId);
        UserResponse saved = userMapper.toResponse(userRepository.save(user));
        auditService.log(
                actorId, "USER_ANONYMIZED", "USER", targetId,
                Map.of("email", previousEmail),
                Map.of("email", user.getEmail()),
                ipAddress, userAgent
        );
        return saved;
    }

    @Override
    @Transactional
    public void deleteUserPermanently(UUID targetId, UUID actorId, String ipAddress, String userAgent) {
        requireNotSelf(targetId, actorId, "permanently delete");
        User user = requireUser(targetId);

        // An open/in-progress ticket may be an active dispute or fraud investigation — the erasure
        // promise on the public delete-account page carves that out as an exception. Checked here
        // rather than left to the DB: support_tickets.user_id cascades unconditionally on delete.
        if (supportTicketRepository.existsByUserIdAndStatusIn(
                targetId, List.of(SupportTicket.Status.OPEN, SupportTicket.Status.IN_PROGRESS))) {
            throw new BusinessException(
                    "This user has an open support ticket. Resolve or close it before permanent deletion.",
                    HttpStatus.CONFLICT);
        }

        String email    = user.getEmail();
        String fullName = user.getFullName();

        // Explicit deletes in dependency order, ahead of the final cascading user delete below:
        // investment_income_log and account_transfers both have FK columns with no ON DELETE
        // policy (or RESTRICT), so leaving them in place would make the user-row cascade fail.
        investmentIncomeLogRepository.deleteByUserId(targetId);
        accountTransferRepository.deleteByUserId(targetId);
        expenseSplitRepository.deleteByPayerUserIdOrParticipantUserId(targetId, targetId);
        expenseRepository.deleteByUserId(targetId);
        assetRepository.deleteByUserId(targetId);
        liabilityRepository.deleteByUserId(targetId);
        vaultItemRepository.deleteByUserId(targetId);
        webAuthnCredentialRepository.deleteByUserId(targetId);

        // Logged before the delete below: audit_logs.user_id is ON DELETE SET NULL, so this row
        // survives the cascade, but only the email/name captured here keep it readable afterward.
        auditService.log(
                actorId, "USER_DELETED_PERMANENTLY", "USER", targetId,
                Map.of("email", email, "fullName", fullName), null,
                ipAddress, userAgent
        );

        // Cascades the rest at the DB level: wallet_accounts, categories, budgets, goals (and their
        // recurring contributions), debt_records (and payments), recurring_income/transfer,
        // notifications, notification_preferences, device_tokens, net_worth_snapshots,
        // refresh_tokens, remaining (non-open) support_tickets and their replies, and
        // email_verification_tokens.
        userRepository.delete(user);
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<AuditLogResponse> getAuditLogs(Pageable pageable, UUID userId, String action) {
        boolean hasFilter = userId != null || StringUtils.hasText(action);
        var logs = hasFilter
                ? auditLogRepository.findWithFilters(userId, action, pageable)
                : auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);

        var userIds = logs.stream()
                .map(l -> l.getUserId())
                .filter(uid -> uid != null)
                .distinct()
                .toList();
        Map<UUID, String> emailMap = userIds.isEmpty()
                ? Map.of()
                : userRepository.findAllById(userIds).stream()
                    .collect(Collectors.toMap(User::getId, User::getEmail));

        var result = logs.map(l -> AuditLogResponse.from(l, l.getUserId() != null
                ? emailMap.getOrDefault(l.getUserId(), "unknown")
                : "system"));
        return PagedResponse.of(result);
    }

    private void requireNotSelf(UUID targetId, UUID actorId, String action) {
        if (targetId.equals(actorId)) {
            throw new BusinessException("You can't " + action + " your own account from the admin panel.", HttpStatus.BAD_REQUEST);
        }
    }

    private User requireUser(UUID id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", id));
    }
}
