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
import java.util.*;
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

        Set<UUID> seenParticipants = new java.util.HashSet<>();
        BigDecimal totalShares = BigDecimal.ZERO;
        for (SplitParticipantRequest p : splitWith) {
            if (p.getUserId().equals(expense.getUserId())) {
                throw new BusinessException("You can't split an expense with yourself.", HttpStatus.BAD_REQUEST);
            }
            if (!familyMemberIds.contains(p.getUserId())) {
                throw new BusinessException("Split participants must be members of your family group.", HttpStatus.BAD_REQUEST);
            }
            if (!seenParticipants.add(p.getUserId())) {
                throw new BusinessException("Each participant can only appear once in a split.", HttpStatus.BAD_REQUEST);
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

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseSplitResponse> getSplitsForExpense(UUID expenseId, UUID userId) {
        Expense expense = findAndValidateOwner(expenseId, userId);
        List<ExpenseSplit> splits = splitRepository.findByExpenseId(expenseId);
        if (splits.isEmpty()) return List.of();

        Map<UUID, Expense> expenseMap = Map.of(expenseId, expense);
        Category category = categoryRepository.findById(expense.getCategoryId()).orElse(null);
        Map<UUID, Category> catMap = category != null ? Map.of(expense.getCategoryId(), category) : Map.of();
        Set<UUID> userIds = Stream.concat(
                splits.stream().map(ExpenseSplit::getPayerUserId),
                splits.stream().map(ExpenseSplit::getParticipantUserId)
        ).collect(Collectors.toSet());
        Map<UUID, String> nameMap = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName));

        return splits.stream().map(s -> toResponse(s, expenseMap, catMap, nameMap)).toList();
    }

    @Override
    @Transactional
    public void addSplits(UUID expenseId, UUID userId, List<SplitParticipantRequest> splitWith) {
        if (splitWith == null || splitWith.isEmpty()) return;
        Expense expense = findAndValidateOwner(expenseId, userId);

        // Unlike createSplits' own check (which only looks at this one batch against the full
        // amount), splitting an ALREADY-split expense further needs to account for shares it
        // already carries — otherwise two separate "add a split" calls could each pass their own
        // check while together promising more than the expense is actually worth.
        BigDecimal existing = splitRepository.sumSharesByExpenseId(expenseId);
        BigDecimal newTotal = splitWith.stream().map(SplitParticipantRequest::getShareAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (existing.add(newTotal).compareTo(expense.getAmount()) > 0) {
            throw new BusinessException(
                    "Split shares can't add up to more than the expense amount.", HttpStatus.BAD_REQUEST);
        }
        createSplits(expense, splitWith);
    }

    private Expense findAndValidateOwner(UUID expenseId, UUID userId) {
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", "id", expenseId));
        if (!expense.getUserId().equals(userId)) throw new AccessDeniedException();
        return expense;
    }

    @Override
    @Transactional(readOnly = true)
    public void validateAmountCoversSplits(UUID expenseId, BigDecimal newAmount) {
        BigDecimal totalShares = splitRepository.sumSharesByExpenseId(expenseId);
        if (totalShares.compareTo(newAmount) > 0) {
            throw new BusinessException(
                    "This expense is split for " + totalShares + " — reduce or remove the splits before lowering the amount below that.",
                    HttpStatus.BAD_REQUEST);
        }
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
