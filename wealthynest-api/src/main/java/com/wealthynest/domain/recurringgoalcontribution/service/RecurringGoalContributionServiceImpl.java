package com.wealthynest.domain.recurringgoalcontribution.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.goal.dto.request.UpdateGoalRequest;
import com.wealthynest.domain.goal.entity.Goal;
import com.wealthynest.domain.goal.repository.GoalRepository;
import com.wealthynest.domain.goal.service.GoalService;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.CreateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.UpdateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.response.RecurringGoalContributionResponse;
import com.wealthynest.domain.recurringgoalcontribution.entity.RecurringGoalContribution;
import com.wealthynest.domain.recurringgoalcontribution.repository.RecurringGoalContributionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecurringGoalContributionServiceImpl implements RecurringGoalContributionService {

    private final RecurringGoalContributionRepository recurringGoalContributionRepository;
    private final GoalRepository                      goalRepository;
    private final GoalService                         goalService;

    @Override
    @Transactional(readOnly = true)
    public List<RecurringGoalContributionResponse> getAll(UUID userId) {
        return recurringGoalContributionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public RecurringGoalContributionResponse create(UUID userId, CreateRecurringGoalContributionRequest req) {
        validateGoalOwnership(req.getGoalId(), userId);
        RecurringGoalContribution rule = RecurringGoalContribution.builder()
                .userId(userId)
                .goalId(req.getGoalId())
                .amount(req.getAmount())
                .dayOfMonth(req.getDayOfMonth())
                .active(true)
                .build();
        return toResponse(recurringGoalContributionRepository.save(rule));
    }

    @Override
    @Transactional
    public RecurringGoalContributionResponse update(UUID id, UUID userId, UpdateRecurringGoalContributionRequest req) {
        RecurringGoalContribution rule = findOwned(id, userId);
        if (req.getGoalId() != null) {
            validateGoalOwnership(req.getGoalId(), userId);
            rule.setGoalId(req.getGoalId());
        }
        if (req.getAmount()     != null) rule.setAmount(req.getAmount());
        if (req.getDayOfMonth() != null) rule.setDayOfMonth(req.getDayOfMonth());
        return toResponse(recurringGoalContributionRepository.save(rule));
    }

    @Override
    @Transactional
    public RecurringGoalContributionResponse toggleActive(UUID id, UUID userId) {
        RecurringGoalContribution rule = findOwned(id, userId);
        rule.setActive(!rule.isActive());
        return toResponse(recurringGoalContributionRepository.save(rule));
    }

    @Override
    @Transactional
    public void delete(UUID id, UUID userId) {
        RecurringGoalContribution rule = findOwned(id, userId);
        recurringGoalContributionRepository.delete(rule);
    }

    @Override
    @Transactional
    public void processScheduled() {
        LocalDate today = LocalDate.now();
        int yyyymm = today.getYear() * 100 + today.getMonthValue();

        List<RecurringGoalContribution> rules = recurringGoalContributionRepository.findByActiveTrue();
        int contributed = 0;
        for (RecurringGoalContribution rule : rules) {
            try {
                if (!isContributionDay(rule.getDayOfMonth(), today)) continue;
                if (rule.getLastContributedMonth() != null && rule.getLastContributedMonth() >= yyyymm) continue;

                Goal goal = goalRepository.findById(rule.getGoalId()).orElse(null);
                // Goal deleted, or already fully funded — nothing to add; leave the rule as-is
                // (not advanced) so it resumes automatically if the goal's target ever changes.
                if (goal == null || goal.getSavedAmount().compareTo(goal.getTargetAmount()) >= 0) continue;

                BigDecimal newSaved = goal.getSavedAmount().add(rule.getAmount()).min(goal.getTargetAmount());
                goalService.update(rule.getGoalId(), rule.getUserId(), buildUpdateRequest(newSaved));

                rule.setLastContributedMonth(yyyymm);
                rule.setLastContributedAt(LocalDateTime.now());
                recurringGoalContributionRepository.save(rule);
                contributed++;
            } catch (Exception e) {
                log.error("Failed to process recurring goal contribution rule {}: {}", rule.getId(), e.getMessage());
            }
        }
        log.info("Recurring goal contribution run: {} rule(s) contributed on {}", contributed, today);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private void validateGoalOwnership(UUID goalId, UUID userId) {
        Goal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new ResourceNotFoundException("Goal", "id", goalId));
        if (!goal.getUserId().equals(userId)) throw new AccessDeniedException();
    }

    /** Same day-of-month semantics as RecurringIncome/RecurringTransfer. */
    private boolean isContributionDay(int dayOfMonth, LocalDate today) {
        if (dayOfMonth == 0) {
            return today.equals(lastWorkingDayOf(today.getYear(), today.getMonthValue()));
        }
        int lastDay = YearMonth.of(today.getYear(), today.getMonthValue()).lengthOfMonth();
        int effectiveDay = Math.min(dayOfMonth, lastDay);
        return today.getDayOfMonth() == effectiveDay;
    }

    private LocalDate lastWorkingDayOf(int year, int month) {
        LocalDate last = YearMonth.of(year, month).atEndOfMonth();
        while (last.getDayOfWeek() == DayOfWeek.SATURDAY || last.getDayOfWeek() == DayOfWeek.SUNDAY) {
            last = last.minusDays(1);
        }
        return last;
    }

    private RecurringGoalContribution findOwned(UUID id, UUID userId) {
        RecurringGoalContribution rule = recurringGoalContributionRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringGoalContribution", "id", id));
        if (!rule.getUserId().equals(userId)) throw new AccessDeniedException("Not your rule");
        return rule;
    }

    private UpdateGoalRequest buildUpdateRequest(BigDecimal newSaved) {
        return new UpdateGoalRequest() {
            public BigDecimal getSavedAmount() { return newSaved; }
        };
    }

    private RecurringGoalContributionResponse toResponse(RecurringGoalContribution r) {
        Goal goal = goalRepository.findById(r.getGoalId()).orElse(null);
        return RecurringGoalContributionResponse.builder()
                .id(r.getId())
                .goalId(r.getGoalId())
                .goalName(goal != null ? goal.getName() : "Unknown Goal")
                .goalIcon(goal != null ? goal.getIcon() : null)
                .goalColor(goal != null ? goal.getColor() : null)
                .amount(r.getAmount())
                .dayOfMonth(r.getDayOfMonth())
                .active(r.isActive())
                .lastContributedMonth(r.getLastContributedMonth())
                .lastContributedAt(r.getLastContributedAt())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
