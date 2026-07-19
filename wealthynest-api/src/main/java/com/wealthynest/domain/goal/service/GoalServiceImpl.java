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
    public List<GoalResponse> getAll(UUID userId) {
        Map<UUID, AccountResponse> accountMap = walletAccountService.getAccounts(userId).stream()
                .collect(Collectors.toMap(AccountResponse::getId, a -> a));
        return goalRepository.findByUserIdOrderByCreatedAtAsc(userId)
                .stream().map(g -> toResponse(g, accountMap)).toList();
    }

    @Override
    @Transactional
    public GoalResponse create(UUID userId, CreateGoalRequest req) {
        BigDecimal saved = req.getSavedAmount() != null ? req.getSavedAmount() : BigDecimal.ZERO;
        if (saved.compareTo(req.getTargetAmount()) > 0)
            throw new BusinessException("Amount already saved cannot exceed the target amount", HttpStatus.BAD_REQUEST);
        accountOwnershipGuard.validateAccountOwnership(req.getAccountId(), userId);

        Goal goal = Goal.builder()
                .userId(userId)
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
    public GoalResponse update(UUID id, UUID userId, UpdateGoalRequest req) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Goal", "id", id));
        if (!goal.getUserId().equals(userId)) throw new AccessDeniedException();

        if (req.getName()         != null) goal.setName(req.getName());
        if (req.getIcon()         != null) goal.setIcon(req.getIcon());
        if (req.getColor()        != null) goal.setColor(req.getColor());
        if (req.getTargetAmount() != null) goal.setTargetAmount(req.getTargetAmount());
        if (req.getSavedAmount()  != null) {
            BigDecimal target = req.getTargetAmount() != null ? req.getTargetAmount() : goal.getTargetAmount();
            if (req.getSavedAmount().compareTo(target) > 0)
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
    public void delete(UUID id, UUID userId) {
        Goal goal = goalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Goal", "id", id));
        if (!goal.getUserId().equals(userId)) throw new AccessDeniedException();
        goalRepository.delete(goal);
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
                .build();
    }
}
