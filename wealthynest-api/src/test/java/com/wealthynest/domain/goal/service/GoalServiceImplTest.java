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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GoalServiceImplTest {

    @Mock private GoalRepository        goalRepository;
    @Mock private WalletAccountService  walletAccountService;
    @Mock private AccountOwnershipGuard accountOwnershipGuard;

    @InjectMocks
    private GoalServiceImpl service;

    private final UUID userId   = UUID.randomUUID();
    private final UUID goalId   = UUID.randomUUID();
    private final UUID familyId = UUID.randomUUID();

    private Goal.GoalBuilder baseGoal() {
        return Goal.builder().userId(userId).name("Emergency Fund")
                .targetAmount(new BigDecimal("100000")).savedAmount(new BigDecimal("20000"));
    }

    private Goal withId(Goal g) {
        ReflectionTestUtils.setField(g, "id", goalId);
        return g;
    }

    private CreateGoalRequest createRequest(BigDecimal target, BigDecimal saved, UUID accountId) {
        CreateGoalRequest req = mock(CreateGoalRequest.class);
        lenient().when(req.getName()).thenReturn("Emergency Fund");
        lenient().when(req.getTargetAmount()).thenReturn(target);
        lenient().when(req.getSavedAmount()).thenReturn(saved);
        lenient().when(req.getAccountId()).thenReturn(accountId);
        lenient().when(req.getIcon()).thenReturn(null);
        lenient().when(req.getColor()).thenReturn(null);
        lenient().when(req.getTargetDate()).thenReturn(null);
        return req;
    }

    private UpdateGoalRequest updateRequest() {
        UpdateGoalRequest req = mock(UpdateGoalRequest.class);
        lenient().when(req.getName()).thenReturn(null);
        lenient().when(req.getIcon()).thenReturn(null);
        lenient().when(req.getColor()).thenReturn(null);
        lenient().when(req.getTargetAmount()).thenReturn(null);
        lenient().when(req.getSavedAmount()).thenReturn(null);
        lenient().when(req.getTargetDate()).thenReturn(null);
        lenient().when(req.getPaused()).thenReturn(null);
        lenient().when(req.getUnlinkAccount()).thenReturn(null);
        lenient().when(req.getAccountId()).thenReturn(null);
        return req;
    }

    private void stubNoAccounts() {
        lenient().when(walletAccountService.getAccounts(userId)).thenReturn(List.of());
    }

    // ─── create ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("create")
    class CreateTests {

        @Test
        @DisplayName("throws when savedAmount exceeds targetAmount")
        void throwsWhenSavedExceedsTarget() {
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), new BigDecimal("1500"), null);

            assertThatThrownBy(() -> service.create(userId, null, req)).isInstanceOf(BusinessException.class);
            verify(goalRepository, never()).save(any());
        }

        @Test
        @DisplayName("does NOT throw when savedAmount exceeds targetAmount and an account is linked — a linked goal's saved amount is a live balance snapshot, not a user-typed cap")
        void allowsSavedExceedingTargetWhenLinked() {
            stubNoAccounts();
            UUID accountId = UUID.randomUUID();
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), new BigDecimal("1500"), accountId);
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            GoalResponse response = service.create(userId, null, req);

            assertThat(response.getAccountId()).isEqualTo(accountId);
            verify(goalRepository).save(any(Goal.class));
        }

        @Test
        @DisplayName("null savedAmount defaults to zero")
        void nullSavedAmountDefaultsToZero() {
            stubNoAccounts();
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), null, null);
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            GoalResponse response = service.create(userId, null, req);

            assertThat(response.getSavedAmount()).isEqualByComparingTo("0");
        }

        @Test
        @DisplayName("savedAmount exactly equal to targetAmount is allowed (boundary)")
        void allowsSavedEqualToTarget() {
            stubNoAccounts();
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), new BigDecimal("1000"), null);
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            GoalResponse response = service.create(userId, null, req);

            assertThat(response.getPercentSaved()).isEqualTo(100.0);
        }

        @Test
        @DisplayName("validates ownership of a linked account before creating")
        void validatesAccountOwnership() {
            stubNoAccounts();
            UUID accountId = UUID.randomUUID();
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), BigDecimal.ZERO, accountId);
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            service.create(userId, null, req);

            verify(accountOwnershipGuard).validateAccountOwnership(accountId, userId);
        }
    }

    // ─── update ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("update")
    class UpdateTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the goal does not exist")
        void throwsWhenNotFound() {
            when(goalRepository.findById(goalId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.update(goalId, userId, null, updateRequest()))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException when the goal belongs to another user")
        void throwsWhenNotOwned() {
            Goal goal = withId(baseGoal().userId(UUID.randomUUID()).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            assertThatThrownBy(() -> service.update(goalId, userId, null, updateRequest()))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("only updates fields present in the request (partial update)")
        void partialUpdate() {
            Goal goal = withId(baseGoal().icon("piggy-bank").build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateGoalRequest req = updateRequest();
            when(req.getName()).thenReturn("Renamed Goal");

            service.update(goalId, userId, null, req);

            assertThat(goal.getName()).isEqualTo("Renamed Goal");
            assertThat(goal.getIcon()).isEqualTo("piggy-bank"); // unchanged
        }

        @Test
        @DisplayName("rejects a new savedAmount that exceeds the goal's current (unchanged) targetAmount")
        void rejectsSavedExceedingCurrentTarget() {
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            UpdateGoalRequest req = updateRequest();
            when(req.getSavedAmount()).thenReturn(new BigDecimal("1500"));

            assertThatThrownBy(() -> service.update(goalId, userId, null, req)).isInstanceOf(BusinessException.class);
            verify(goalRepository, never()).save(any());
        }

        @Test
        @DisplayName("validates savedAmount against a NEW targetAmount when both are updated together")
        void validatesSavedAgainstNewTargetInSameRequest() {
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            UpdateGoalRequest req = updateRequest();
            when(req.getTargetAmount()).thenReturn(new BigDecimal("5000"));
            when(req.getSavedAmount()).thenReturn(new BigDecimal("3000")); // > old target(1000) but < new(5000)
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));

            service.update(goalId, userId, null, req);

            assertThat(goal.getSavedAmount()).isEqualByComparingTo("3000");
        }

        @Test
        @DisplayName("unlinkAccount=true clears the account link even if an accountId is also present")
        void unlinkAccountTakesPrecedenceOverAccountId() {
            UUID oldAccount = UUID.randomUUID();
            Goal goal = withId(baseGoal().accountId(oldAccount).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateGoalRequest req = updateRequest();
            when(req.getUnlinkAccount()).thenReturn(true);
            // Stubbed but never read by the service — unlinkAccount short-circuits before accountId
            // is even consulted, which is exactly the branch precedence this test verifies.
            lenient().when(req.getAccountId()).thenReturn(UUID.randomUUID());

            service.update(goalId, userId, null, req);

            assertThat(goal.getAccountId()).isNull();
            verify(accountOwnershipGuard, never()).validateAccountOwnership(any(), any());
        }

        @Test
        @DisplayName("linking a new account validates its ownership")
        void linkingNewAccountValidatesOwnership() {
            Goal goal = withId(baseGoal().build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UUID newAccountId = UUID.randomUUID();
            UpdateGoalRequest req = updateRequest();
            when(req.getAccountId()).thenReturn(newAccountId);

            service.update(goalId, userId, null, req);

            verify(accountOwnershipGuard).validateAccountOwnership(newAccountId, userId);
            assertThat(goal.getAccountId()).isEqualTo(newAccountId);
        }

        @Test
        @DisplayName("does NOT reject an over-target savedAmount when linking a new account in the same request")
        void allowsSavedExceedingTargetWhenLinkingInSameRequest() {
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UUID newAccountId = UUID.randomUUID();
            UpdateGoalRequest req = updateRequest();
            when(req.getAccountId()).thenReturn(newAccountId);
            when(req.getSavedAmount()).thenReturn(new BigDecimal("1500")); // > target(1000), but linking

            service.update(goalId, userId, null, req);

            assertThat(goal.getSavedAmount()).isEqualByComparingTo("1500");
            assertThat(goal.getAccountId()).isEqualTo(newAccountId);
        }

        @Test
        @DisplayName("does NOT reject an over-target savedAmount edit on a goal that's already linked (no accountId in this request)")
        void allowsSavedExceedingTargetWhenAlreadyLinked() {
            UUID existingAccount = UUID.randomUUID();
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).accountId(existingAccount).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateGoalRequest req = updateRequest();
            when(req.getSavedAmount()).thenReturn(new BigDecimal("1500"));

            service.update(goalId, userId, null, req);

            assertThat(goal.getSavedAmount()).isEqualByComparingTo("1500");
        }

        @Test
        @DisplayName("still rejects an over-target savedAmount when simultaneously unlinking — the goal is going back to manually-tracked")
        void rejectsSavedExceedingTargetWhenUnlinking() {
            UUID existingAccount = UUID.randomUUID();
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).accountId(existingAccount).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            UpdateGoalRequest req = updateRequest();
            when(req.getUnlinkAccount()).thenReturn(true);
            when(req.getSavedAmount()).thenReturn(new BigDecimal("1500"));

            assertThatThrownBy(() -> service.update(goalId, userId, null, req)).isInstanceOf(BusinessException.class);
            verify(goalRepository, never()).save(any());
        }

        @Test
        @DisplayName("toggles paused")
        void togglesPaused() {
            Goal goal = withId(baseGoal().paused(false).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateGoalRequest req = updateRequest();
            when(req.getPaused()).thenReturn(true);

            service.update(goalId, userId, null, req);

            assertThat(goal.isPaused()).isTrue();
        }
    }

    // ─── delete ──────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("delete")
    class DeleteTests {

        @Test
        @DisplayName("throws when the goal does not exist")
        void throwsWhenNotFound() {
            when(goalRepository.findById(goalId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.delete(goalId, userId, null)).isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws when the goal belongs to another user")
        void throwsWhenNotOwned() {
            Goal goal = withId(baseGoal().userId(UUID.randomUUID()).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            assertThatThrownBy(() -> service.delete(goalId, userId, null)).isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("deletes an owned goal")
        void deletesOwnedGoal() {
            Goal goal = withId(baseGoal().build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));

            service.delete(goalId, userId, null);

            verify(goalRepository).delete(goal);
        }
    }

    // ─── toResponse / percentSaved / account-linked progress (via getAll) ──────────

    @Nested
    @DisplayName("progress calculation (percentSaved, account-linked savedAmount override)")
    class ProgressCalculationTests {

        @Test
        @DisplayName("without a linked account, effective savedAmount is the goal's own stored value")
        void unlinkedGoalUsesStoredSavedAmount() {
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).savedAmount(new BigDecimal("250")).build());
            stubNoAccounts();
            when(goalRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(goal));

            GoalResponse response = service.getAll(userId, null).get(0);

            assertThat(response.getSavedAmount()).isEqualByComparingTo("250");
            assertThat(response.getPercentSaved()).isEqualTo(25.0);
        }

        @Test
        @DisplayName("a linked account's live current balance OVERRIDES the goal's stored savedAmount")
        void linkedAccountBalanceOverridesStoredSavedAmount() {
            UUID accountId = UUID.randomUUID();
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).savedAmount(new BigDecimal("250"))
                    .accountId(accountId).build());
            AccountResponse account = AccountResponse.builder().id(accountId).name("HDFC Savings")
                    .currentBalance(new BigDecimal("600")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(account));
            when(goalRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(goal));

            GoalResponse response = service.getAll(userId, null).get(0);

            // 600 (live balance), not 250 (stored savedAmount)
            assertThat(response.getSavedAmount()).isEqualByComparingTo("600");
            assertThat(response.getAccountName()).isEqualTo("HDFC Savings");
            assertThat(response.getPercentSaved()).isEqualTo(60.0);
        }

        @Test
        @DisplayName("a negative account balance is floored at zero, not shown as negative progress")
        void negativeAccountBalanceFlooredAtZero() {
            UUID accountId = UUID.randomUUID();
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).accountId(accountId).build());
            AccountResponse account = AccountResponse.builder().id(accountId).name("Overdrawn")
                    .currentBalance(new BigDecimal("-50")).build();
            when(walletAccountService.getAccounts(userId)).thenReturn(List.of(account));
            when(goalRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(goal));

            GoalResponse response = service.getAll(userId, null).get(0);

            assertThat(response.getSavedAmount()).isEqualByComparingTo("0");
            assertThat(response.getPercentSaved()).isEqualTo(0.0);
        }

        @Test
        @DisplayName("falls back to the stored savedAmount when the linked account no longer resolves (e.g. deleted)")
        void fallsBackWhenLinkedAccountMissing() {
            UUID missingAccountId = UUID.randomUUID();
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).savedAmount(new BigDecimal("400"))
                    .accountId(missingAccountId).build());
            stubNoAccounts(); // account map has nothing for missingAccountId
            when(goalRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(goal));

            GoalResponse response = service.getAll(userId, null).get(0);

            assertThat(response.getSavedAmount()).isEqualByComparingTo("400");
            assertThat(response.getAccountName()).isNull();
        }

        @Test
        @DisplayName("percentSaved is capped at 100 even when saved/balance exceeds the target")
        void percentSavedCappedAt100() {
            Goal goal = withId(baseGoal().targetAmount(new BigDecimal("1000")).savedAmount(new BigDecimal("5000")).build());
            stubNoAccounts();
            when(goalRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(goal));

            GoalResponse response = service.getAll(userId, null).get(0);

            assertThat(response.getPercentSaved()).isEqualTo(100.0);
        }

        @Test
        @DisplayName("getAll fetches the account map exactly once, not once per goal (no N+1)")
        void getAllBatchesAccountLookup() {
            Goal goal1 = withId(baseGoal().build());
            Goal goal2 = Goal.builder().userId(userId).name("Vacation").targetAmount(new BigDecimal("5000"))
                    .savedAmount(BigDecimal.ZERO).build();
            ReflectionTestUtils.setField(goal2, "id", UUID.randomUUID());
            stubNoAccounts();
            when(goalRepository.findByUserIdOrderByCreatedAtAsc(userId)).thenReturn(List.of(goal1, goal2));

            service.getAll(userId, null);

            verify(walletAccountService, times(1)).getAccounts(userId);
        }
    }

    // ─── family sharing ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("family sharing")
    class FamilySharingTests {

        @Test
        @DisplayName("create sets familyId when the caller is in a family, and the response reports shared=true")
        void createSetsFamilyIdWhenInFamily() {
            stubNoAccounts();
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), BigDecimal.ZERO, null);
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            GoalResponse response = service.create(userId, familyId, req);

            ArgumentCaptor<Goal> captor = ArgumentCaptor.forClass(Goal.class);
            verify(goalRepository).save(captor.capture());
            assertThat(captor.getValue().getFamilyId()).isEqualTo(familyId);
            assertThat(captor.getValue().getUserId()).isEqualTo(userId); // creator still recorded
            assertThat(response.isShared()).isTrue();
        }

        @Test
        @DisplayName("create leaves familyId null and reports shared=false for a personal-scope caller")
        void createLeavesFamilyIdNullWhenPersonal() {
            stubNoAccounts();
            CreateGoalRequest req = createRequest(new BigDecimal("1000"), BigDecimal.ZERO, null);
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> withId(inv.getArgument(0)));

            GoalResponse response = service.create(userId, null, req);

            assertThat(response.isShared()).isFalse();
        }

        @Test
        @DisplayName("getAll uses the family-scoped query instead of the personal one when in a family")
        void getAllUsesFamilyScopeWhenInFamily() {
            Goal goal = withId(baseGoal().familyId(familyId).build());
            stubNoAccounts();
            when(goalRepository.findByFamilyIdOrderByCreatedAtAsc(familyId)).thenReturn(List.of(goal));

            List<GoalResponse> result = service.getAll(userId, familyId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).isShared()).isTrue();
            verify(goalRepository, never()).findByUserIdOrderByCreatedAtAsc(any());
        }

        @Test
        @DisplayName("a family member who didn't create the goal can still update it")
        void familyMemberCanUpdateSharedGoal() {
            UUID creator = UUID.randomUUID();
            Goal goal = withId(Goal.builder().userId(creator).familyId(familyId).name("Family Trip")
                    .targetAmount(new BigDecimal("2000")).savedAmount(BigDecimal.ZERO).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));
            stubNoAccounts();
            when(goalRepository.save(any(Goal.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateGoalRequest req = updateRequest();
            when(req.getSavedAmount()).thenReturn(new BigDecimal("500"));

            service.update(goalId, userId, familyId, req);

            assertThat(goal.getSavedAmount()).isEqualByComparingTo("500");
        }

        @Test
        @DisplayName("a caller outside the family and not the creator cannot update a shared goal")
        void outsiderCannotUpdateSharedGoal() {
            UUID creator = UUID.randomUUID();
            UUID otherFamily = UUID.randomUUID();
            Goal goal = withId(Goal.builder().userId(creator).familyId(familyId).name("Family Trip")
                    .targetAmount(new BigDecimal("2000")).savedAmount(BigDecimal.ZERO).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));

            assertThatThrownBy(() -> service.update(goalId, userId, otherFamily, updateRequest()))
                    .isInstanceOf(AccessDeniedException.class);
            verify(goalRepository, never()).save(any());
        }

        @Test
        @DisplayName("a family member who didn't create the goal can still delete it")
        void familyMemberCanDeleteSharedGoal() {
            UUID creator = UUID.randomUUID();
            Goal goal = withId(Goal.builder().userId(creator).familyId(familyId).name("Family Trip")
                    .targetAmount(new BigDecimal("2000")).savedAmount(BigDecimal.ZERO).build());
            when(goalRepository.findById(goalId)).thenReturn(Optional.of(goal));

            service.delete(goalId, UUID.randomUUID(), familyId);

            verify(goalRepository).delete(goal);
        }
    }
}
