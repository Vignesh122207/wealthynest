package com.wealthynest.domain.expensesplit.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expensesplit.dto.request.SplitParticipantRequest;
import com.wealthynest.domain.expensesplit.dto.response.ExpenseSplitResponse;
import com.wealthynest.domain.expensesplit.dto.response.MySplitsResponse;
import com.wealthynest.domain.expensesplit.dto.response.SplitBalanceResponse;
import com.wealthynest.domain.expensesplit.entity.ExpenseSplit;
import com.wealthynest.domain.expensesplit.entity.SplitStatus;
import com.wealthynest.domain.expensesplit.repository.ExpenseSplitRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class ExpenseSplitServiceImpl implements ExpenseSplitService {

    private final ExpenseSplitRepository splitRepository;
    private final ExpenseRepository      expenseRepository;
    private final CategoryRepository     categoryRepository;
    private final UserRepository         userRepository;

    @Override
    @Transactional
    public void createSplits(Expense expense, List<SplitParticipantRequest> splitWith) {
        if (splitWith == null || splitWith.isEmpty()) return;
        if (expense.getFamilyId() == null) {
            throw new BusinessException("Splitting an expense requires being in a family group.", HttpStatus.BAD_REQUEST);
        }
        Set<UUID> familyMemberIds = userRepository.findByFamilyId(expense.getFamilyId())
                .stream().map(User::getId).collect(Collectors.toSet());

        BigDecimal totalShares = BigDecimal.ZERO;
        for (SplitParticipantRequest p : splitWith) {
            if (p.getUserId().equals(expense.getUserId())) {
                throw new BusinessException("You can't split an expense with yourself.", HttpStatus.BAD_REQUEST);
            }
            if (!familyMemberIds.contains(p.getUserId())) {
                throw new BusinessException("Split participants must be members of your family group.", HttpStatus.BAD_REQUEST);
            }
            totalShares = totalShares.add(p.getShareAmount());
        }
        if (totalShares.compareTo(expense.getAmount()) > 0) {
            throw new BusinessException("Split shares can't add up to more than the expense amount.", HttpStatus.BAD_REQUEST);
        }

        List<ExpenseSplit> splits = splitWith.stream().map(p -> ExpenseSplit.builder()
                .expenseId(expense.getId())
                .familyId(expense.getFamilyId())
                .payerUserId(expense.getUserId())
                .participantUserId(p.getUserId())
                .shareAmount(p.getShareAmount())
                .build()).toList();
        splitRepository.saveAll(splits);
    }

    @Override
    @Transactional(readOnly = true)
    public MySplitsResponse getMySplits(UUID userId) {
        List<ExpenseSplit> owedToMe = splitRepository.findByPayerUserIdAndStatus(userId, SplitStatus.PENDING);
        List<ExpenseSplit> iOwe     = splitRepository.findByParticipantUserIdAndStatus(userId, SplitStatus.PENDING);

        List<ExpenseSplit> all = Stream.concat(owedToMe.stream(), iOwe.stream()).toList();
        Set<UUID> expenseIds = all.stream().map(ExpenseSplit::getExpenseId).collect(Collectors.toSet());
        Map<UUID, Expense> expenseMap = expenseIds.isEmpty() ? Map.of()
                : expenseRepository.findAllById(expenseIds).stream()
                        .collect(Collectors.toMap(Expense::getId, e -> e));
        Set<UUID> catIds = expenseMap.values().stream().map(Expense::getCategoryId).collect(Collectors.toSet());
        Map<UUID, Category> catMap = catIds.isEmpty() ? Map.of()
                : categoryRepository.findAllById(catIds).stream().collect(Collectors.toMap(Category::getId, c -> c));
        Set<UUID> userIds = Stream.concat(
                all.stream().map(ExpenseSplit::getPayerUserId),
                all.stream().map(ExpenseSplit::getParticipantUserId)
        ).collect(Collectors.toSet());
        Map<UUID, String> nameMap = userIds.isEmpty() ? Map.of()
                : userRepository.findAllById(userIds).stream()
                        .collect(Collectors.toMap(User::getId, User::getFullName));

        // Net balance per counterpart: what they owe me minus what I owe them.
        Map<UUID, BigDecimal> net = new HashMap<>();
        for (ExpenseSplit s : owedToMe) net.merge(s.getParticipantUserId(), s.getShareAmount(), BigDecimal::add);
        for (ExpenseSplit s : iOwe)     net.merge(s.getPayerUserId(), s.getShareAmount().negate(), BigDecimal::add);

        List<SplitBalanceResponse> balances = net.entrySet().stream()
                .filter(e -> e.getValue().compareTo(BigDecimal.ZERO) != 0)
                .map(e -> SplitBalanceResponse.builder()
                        .counterpartUserId(e.getKey())
                        .counterpartName(nameMap.getOrDefault(e.getKey(), "Unknown"))
                        .netAmount(e.getValue())
                        .build())
                .sorted((a, b) -> b.getNetAmount().abs().compareTo(a.getNetAmount().abs()))
                .toList();

        List<ExpenseSplitResponse> pending = all.stream()
                .map(s -> toResponse(s, expenseMap, catMap, nameMap))
                .sorted((a, b) -> b.getExpenseDate().compareTo(a.getExpenseDate()))
                .toList();

        return MySplitsResponse.builder().balances(balances).pending(pending).build();
    }

    @Override
    @Transactional
    public void settleSplit(UUID splitId, UUID userId) {
        ExpenseSplit split = splitRepository.findById(splitId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpenseSplit", "id", splitId));
        boolean involved = split.getPayerUserId().equals(userId) || split.getParticipantUserId().equals(userId);
        if (!involved) throw new AccessDeniedException();
        split.setStatus(SplitStatus.SETTLED);
        split.setSettledAt(Instant.now());
        splitRepository.save(split);
    }

    @Override
    @Transactional
    public void settleWithCounterpart(UUID userId, UUID counterpartId) {
        splitRepository.settleBetween(userId, counterpartId, Instant.now());
    }

    private ExpenseSplitResponse toResponse(ExpenseSplit s, Map<UUID, Expense> expenseMap,
                                             Map<UUID, Category> catMap, Map<UUID, String> nameMap) {
        Expense expense = expenseMap.get(s.getExpenseId());
        Category cat = expense != null ? catMap.get(expense.getCategoryId()) : null;
        return ExpenseSplitResponse.builder()
                .id(s.getId())
                .expenseId(s.getExpenseId())
                .expenseDescription(expense != null ? expense.getDescription() : null)
                .categoryName(cat != null ? cat.getName() : null)
                .expenseDate(expense != null ? expense.getExpenseDate() : null)
                .payerUserId(s.getPayerUserId())
                .payerName(nameMap.getOrDefault(s.getPayerUserId(), "Unknown"))
                .participantUserId(s.getParticipantUserId())
                .participantName(nameMap.getOrDefault(s.getParticipantUserId(), "Unknown"))
                .shareAmount(s.getShareAmount())
                .status(s.getStatus())
                .settledAt(s.getSettledAt())
                .build();
    }
}
