package com.wealthynest.domain.recurringgoalcontribution.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.goal.dto.request.UpdateGoalRequest;
import com.wealthynest.domain.goal.entity.Goal;
import com.wealthynest.domain.goal.repository.GoalRepository;
import com.wealthynest.domain.goal.service.GoalService;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.CreateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.dto.request.UpdateRecurringGoalContributionRequest;
import com.wealthynest.domain.recurringgoalcontribution.entity.RecurringGoalContribution;
import com.wealthynest.domain.recurringgoalcontribution.repository.RecurringGoalContributionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecurringGoalContributionServiceImplTest {

    @Mock private RecurringGoalContributionRepository recurringGoalContributionRepository;
    @Mock private GoalRepository goalRepository;
    @Mock private GoalService    goalService;

    @InjectMocks
    private RecurringGoalContributionServiceImpl service;

    private final UUID userId = UUID.randomUUID();
    private final UUID goalId = UUID.randomUUID();
    private final UUID ruleId = UUID.randomUUID();
    private final LocalDate today = LocalDate.now();
    private final int yyyymm = today.getYear() * 100 + today.getMonthValue();

    private RecurringGoalContribution.RecurringGoalContributionBuilder baseRule() {
        return RecurringGoalContribution.builder().userId(userId).goalId(goalId)
                .amount(new BigDecimal("500")).dayOfMonth(today.getDayOfMonth()).active(true);
    }

    private RecurringGoalContribution withId(RecurringGoalContribution r) {
        ReflectionTestUtils.setField(r, "id", ruleId);
        return r;
    }

    // ─── create / update ownership ───────────────────────────────────────────────

    @Nested
    @DisplayName("create / update: goal ownership")
    class OwnershipTests {

        @Test
        @DisplayName("create throws when the goal doesn't exist")
        void createThrowsForUnknownGoal() {
            when(goalRepository.findById(goalId)).thenReturn(Optional.empty());
            CreateRecurringGoalContributionRequest req = mock(CreateRecurringGoalContributionRequest.class);
            when(req.getGoalId()).thenReturn(goalId);
            assertThatThrownBy(() -> service.create(userId, req)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("create throws when the goal belongs to another user")
        void createThrowsWhenGoalNotOwned() {
            Goal goal = Goal.builder().userId(UUID.randomUUID()).build();
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            CreateRecurringGoalContributionRequest req = mock(CreateRecurringGoalContributionRequest.class);
            when(req.getGoalId()).thenReturn(goalId);
            assertThatThrownBy(() -> service.create(userId, req)).isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("update re-validates ownership only when goalId changes")
        void updateRevalidatesOnlyWhenGoalChanges() {
            RecurringGoalContribution rule = withId(baseRule().build());
            when(recurringGoalContributionRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.of(rule));
            when(recurringGoalContributionRepository.save(any(RecurringGoalContribution.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateRecurringGoalContributionRequest req = mock(UpdateRecurringGoalContributionRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("999"));

            service.update(ruleId, userId, req);

            // findById(goalId) is still called once from toResponse()'s display enrichment — the
            // thing NOT happening is a second, ownership-validating lookup, so assert exactly one.
            verify(goalRepository, times(1)).findById(goalId);
            assertThat(rule.getAmount()).isEqualByComparingTo("999");
        }
    }

    // ─── processScheduled ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("processScheduled")
    class ProcessScheduledTests {

        @Test
        @DisplayName("contributes the rule's amount to the goal's savedAmount and advances lastContributedMonth")
        void contributesAndAdvancesMonth() {
            RecurringGoalContribution rule = withId(baseRule().build());
            when(recurringGoalContributionRepository.findByActiveTrue()).thenReturn(List.of(rule));
            Goal goal = Goal.builder().userId(userId).savedAmount(new BigDecimal("1000")).targetAmount(new BigDecimal("5000")).build();
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            when(recurringGoalContributionRepository.save(any(RecurringGoalContribution.class))).thenAnswer(inv -> inv.getArgument(0));

            service.processScheduled();

            ArgumentCaptor<UpdateGoalRequest> captor = ArgumentCaptor.forClass(UpdateGoalRequest.class);
            verify(goalService).update(eq(goalId), eq(userId), captor.capture());
            assertThat(captor.getValue().getSavedAmount()).isEqualByComparingTo("1500"); // 1000 + 500
            assertThat(rule.getLastContributedMonth()).isEqualTo(yyyymm);
        }

        @Test
        @DisplayName("caps the contribution at the goal's target instead of overshooting it")
        void capsContributionAtTarget() {
            RecurringGoalContribution rule = withId(baseRule().amount(new BigDecimal("500")).build());
            when(recurringGoalContributionRepository.findByActiveTrue()).thenReturn(List.of(rule));
            Goal goal = Goal.builder().userId(userId).savedAmount(new BigDecimal("4800")).targetAmount(new BigDecimal("5000")).build();
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            when(recurringGoalContributionRepository.save(any(RecurringGoalContribution.class))).thenAnswer(inv -> inv.getArgument(0));

            service.processScheduled();

            ArgumentCaptor<UpdateGoalRequest> captor = ArgumentCaptor.forClass(UpdateGoalRequest.class);
            verify(goalService).update(eq(goalId), eq(userId), captor.capture());
            assertThat(captor.getValue().getSavedAmount()).isEqualByComparingTo("5000"); // capped, not 5300
        }

        @Test
        @DisplayName("skips a goal that's already fully funded, without advancing the rule")
        void skipsFullyFundedGoal() {
            RecurringGoalContribution rule = withId(baseRule().build());
            when(recurringGoalContributionRepository.findByActiveTrue()).thenReturn(List.of(rule));
            Goal goal = Goal.builder().userId(userId).savedAmount(new BigDecimal("5000")).targetAmount(new BigDecimal("5000")).build();
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));

            service.processScheduled();

            verifyNoInteractions(goalService);
            assertThat(rule.getLastContributedMonth()).isNull();
        }

        @Test
        @DisplayName("gracefully skips when the goal has been deleted, without throwing")
        void skipsDeletedGoal() {
            RecurringGoalContribution rule = withId(baseRule().build());
            when(recurringGoalContributionRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(goalRepository.findById(goalId)).thenReturn(Optional.empty());

            service.processScheduled(); // must not throw

            verifyNoInteractions(goalService);
        }

        @Test
        @DisplayName("skips a rule already contributed to this month")
        void skipsAlreadyContributedThisMonth() {
            RecurringGoalContribution rule = withId(baseRule().build());
            rule.setLastContributedMonth(yyyymm);
            when(recurringGoalContributionRepository.findByActiveTrue()).thenReturn(List.of(rule));

            service.processScheduled();

            verifyNoInteractions(goalRepository, goalService);
        }

        @Test
        @DisplayName("a failure processing one rule is swallowed, not propagated")
        void perRuleFailureSwallowed() {
            RecurringGoalContribution rule = withId(baseRule().build());
            when(recurringGoalContributionRepository.findByActiveTrue()).thenReturn(List.of(rule));
            when(goalRepository.findById(goalId)).thenThrow(new RuntimeException("DB blip"));

            service.processScheduled(); // must not throw
        }
    }

    // ─── toggleActive / delete ───────────────────────────────────────────────────

    @Test
    @DisplayName("toggleActive flips the flag; delete removes an owned rule")
    void toggleAndDelete() {
        RecurringGoalContribution rule = withId(baseRule().active(true).build());
        when(recurringGoalContributionRepository.findByIdAndUserId(ruleId, userId)).thenReturn(Optional.of(rule));
        when(recurringGoalContributionRepository.save(any(RecurringGoalContribution.class))).thenAnswer(inv -> inv.getArgument(0));

        service.toggleActive(ruleId, userId);
        assertThat(rule.isActive()).isFalse();

        service.delete(ruleId, userId);
        verify(recurringGoalContributionRepository).delete(rule);
    }
}
