package com.wealthynest.domain.goal.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.dto.response.AccountResponse;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.goal.dto.request.CreateGoalRequest;
import com.wealthynest.domain.goal.dto.request.UpdateGoalRequest;
import com.wealthynest.domain.goal.dto.response.GoalResponse;
import com.wealthynest.domain.goal.entity.Goal;
import com.wealthynest.domain.goal.repository.GoalRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GoalServiceImpl implements GoalService {

    private final GoalRepository        goalRepository;
    private final WalletAccountService  walletAccountService;
    private final AccountOwnershipGuard accountOwnershipGuard;

    @Override
    @Transactional(readOnly = true)
    public List<GoalResponse> getAll(UUID userId, UUID familyId) {
        Map<UUID, AccountResponse> accountMap = buildAccountMap(userId);
        List<Goal> goals = familyId != null
                ? goalRepository.findByFamilyIdOrderByCreatedAtAsc(familyId)
                : goalRepository.findByUserIdOrderByCreatedAtAsc(userId);
        return goals.stream().map(g -> toResponse(g, accountMap)).toList();
    }

    @Override
    @Transactional
    public GoalResponse create(UUID userId, UUID familyId, CreateGoalRequest req) {
        BigDecimal saved = req.getSavedAmount() != null ? req.getSavedAmount() : BigDecimal.ZERO;
        // A linked goal's saved amount is just a snapshot of the account's balance at link time —
        // toResponse() always re-derives the *displayed* figure live from the account afterwards,
        // so this stored value isn't authoritative once linked, and the account can perfectly
        // validly already hold more than the goal's target (the goal simply starts complete).
        // Only an unlinked, manually-tracked goal needs this cap on what a user can type in.
        if (req.getAccountId() == null && saved.compareTo(req.getTargetAmount()) > 0)
            throw new BusinessException("Amount already saved cannot exceed the target amount", HttpStatus.BAD_REQUEST);
        accountOwnershipGuard.validateAccountOwnership(req.getAccountId(), userId);

        // A goal is family-shared whenever its creator currently belongs to a family — same
        // convention as Budget/Category/Expense/Asset/Liability (see CategoryServiceImpl.createCategory).
        Goal goal = Goal.builder()
                .userId(userId)
                .familyId(familyId)
                .name(req.getName())
                .icon(req.getIcon())
                .color(req.getColor())
                .targetAmount(req.getTargetAmount())
                .savedAmount(saved)
                .targetDate(req.getTargetDate())
                .accountId(req.getAccountId())
                .build();
        return toResponse(goalRepository.save(goal), buildAccountMap(userId));
    }

    @Override
    @Transactional
    public GoalResponse update(UUID id, UUID userId, UUID familyId, UpdateGoalRequest req) {
        Goal goal = findAndValidateOwner(id, userId, familyId);

        if (req.getName()         != null) goal.setName(req.getName());
        if (req.getIcon()         != null) goal.setIcon(req.getIcon());
        if (req.getColor()        != null) goal.setColor(req.getColor());
        if (req.getTargetAmount() != null) goal.setTargetAmount(req.getTargetAmount());
        // Same "linked goals aren't capped" reasoning as create() above — accountId/unlinkAccount
        // arrive in this same request when (un)linking happens alongside a savedAmount edit (see
        // GoalsPage.onUpdateSubmit), so this has to look at where the goal is *ending up* linked,
        // not just goal.getAccountId()'s pre-update value.
        boolean willBeLinked = !Boolean.TRUE.equals(req.getUnlinkAccount())
            && (req.getAccountId() != null || goal.getAccountId() != null);
        if (req.getSavedAmount()  != null) {
            BigDecimal target = req.getTargetAmount() != null ? req.getTargetAmount() : goal.getTargetAmount();
            if (!willBeLinked && req.getSavedAmount().compareTo(target) > 0)
                throw new BusinessException("Amount saved cannot exceed the target amount", HttpStatus.BAD_REQUEST);
            goal.setSavedAmount(req.getSavedAmount());
        }
        if (req.getTargetDate()   != null) goal.setTargetDate(req.getTargetDate());
        if (req.getPaused()       != null) goal.setPaused(req.getPaused());
        if (Boolean.TRUE.equals(req.getUnlinkAccount())) {
            goal.setAccountId(null);
        } else if (req.getAccountId() != null) {
            accountOwnershipGuard.validateAccountOwnership(req.getAccountId(), userId);
            goal.setAccountId(req.getAccountId());
        }
        return toResponse(goalRepository.save(goal), buildAccountMap(userId));
    }

    @Override
    @Transactional
    public void delete(UUID id, UUID userId, UUID familyId) {
        Goal goal = findAndValidateOwner(id, userId, familyId);
        goalRepository.delete(goal);
    }

    /** Any family member (not just the creator) can update/delete a family-shared goal — mirrors
     *  BudgetServiceImpl.findAndValidateOwner. */
    private Goal findAndValidateOwner(UUID id, UUID userId, UUID familyId) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Goal", "id", id));
        boolean owned = (familyId != null && familyId.equals(goal.getFamilyId()))
                     || (userId   != null && userId.equals(goal.getUserId()));
        if (!owned) throw new AccessDeniedException();
        return goal;
    }

    private Map<UUID, AccountResponse> buildAccountMap(UUID userId) {
        return walletAccountService.getAccounts(userId).stream()
                .collect(Collectors.toMap(AccountResponse::getId, a -> a));
    }

    private GoalResponse toResponse(Goal g, Map<UUID, AccountResponse> accountMap) {
        BigDecimal effective  = g.getSavedAmount();
        String     accountName = null;
        if (g.getAccountId() != null) {
            AccountResponse acct = accountMap.get(g.getAccountId());
            if (acct != null) {
                effective   = acct.getCurrentBalance().max(BigDecimal.ZERO);
                accountName = acct.getName();
            }
        }
        double pct = g.getTargetAmount().compareTo(BigDecimal.ZERO) > 0
                ? effective.doubleValue() / g.getTargetAmount().doubleValue() * 100.0
                : 0.0;
        return GoalResponse.builder()
                .id(g.getId())
                .name(g.getName())
                .icon(g.getIcon())
                .color(g.getColor())
                .targetAmount(g.getTargetAmount())
                .savedAmount(effective)
                .targetDate(g.getTargetDate())
                .percentSaved(Math.min(100.0, pct))
                .createdAt(g.getCreatedAt())
                .accountId(g.getAccountId())
                .accountName(accountName)
                .paused(g.isPaused())
                .shared(g.getFamilyId() != null)
                .build();
    }
}
