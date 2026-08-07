package com.wealthynest.domain.expensesplit.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.BusinessException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expensesplit.dto.request.SplitParticipantRequest;
import com.wealthynest.domain.expensesplit.dto.response.MySplitsResponse;
import com.wealthynest.domain.expensesplit.dto.response.SplitBalanceResponse;
import com.wealthynest.domain.expensesplit.entity.ExpenseSplit;
import com.wealthynest.domain.expensesplit.entity.SplitStatus;
import com.wealthynest.domain.expensesplit.repository.ExpenseSplitRepository;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.domain.user.repository.UserRepository;
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
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseSplitServiceImplTest {

    @Mock private ExpenseSplitRepository splitRepository;
    @Mock private ExpenseRepository      expenseRepository;
    @Mock private CategoryRepository     categoryRepository;
    @Mock private UserRepository         userRepository;

    @InjectMocks
    private ExpenseSplitServiceImpl service;

    private final UUID familyId = UUID.randomUUID();
    private final UUID payerId  = UUID.randomUUID();
    private final UUID friendId = UUID.randomUUID();
    private final UUID expenseId = UUID.randomUUID();

    private Expense expenseOf(UUID payer, UUID family, BigDecimal amount) {
        return resolvableExpense(expenseId, payer, family, amount);
    }

    private Expense resolvableExpense(UUID id, UUID payer, UUID family, BigDecimal amount) {
        Expense e = Expense.builder().userId(payer).familyId(family).categoryId(UUID.randomUUID())
                .amount(amount).expenseDate(LocalDate.now()).build();
        ReflectionTestUtils.setField(e, "id", id);
        return e;
    }

    private SplitParticipantRequest participant(UUID userId, BigDecimal share) {
        SplitParticipantRequest p = mock(SplitParticipantRequest.class);
        lenient().when(p.getUserId()).thenReturn(userId);
        lenient().when(p.getShareAmount()).thenReturn(share);
        return p;
    }

    private User userOf(UUID id, String name) {
        User u = User.builder().fullName(name).build();
        ReflectionTestUtils.setField(u, "id", id);
        return u;
    }

    // ─── createSplits ────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createSplits")
    class CreateSplitsTests {

        @Test
        @DisplayName("no-op when splitWith is null or empty")
        void noOpWhenEmpty() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));

            service.createSplits(expense, null);
            service.createSplits(expense, List.of());

            verify(splitRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("throws when the expense has no family (personal expenses can't be split)")
        void throwsWithoutFamily() {
            Expense expense = expenseOf(payerId, null, new BigDecimal("100"));
            List<SplitParticipantRequest> splits = List.of(participant(friendId, new BigDecimal("50")));

            assertThatThrownBy(() -> service.createSplits(expense, splits))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when a participant is the payer themself")
        void throwsWhenSplittingWithSelf() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend")));
            List<SplitParticipantRequest> splits = List.of(participant(payerId, new BigDecimal("50")));

            assertThatThrownBy(() -> service.createSplits(expense, splits))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when a participant is not a member of the expense's family")
        void throwsWhenParticipantNotFamilyMember() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(userOf(payerId, "Payer")));
            UUID outsider = UUID.randomUUID();
            List<SplitParticipantRequest> splits = List.of(participant(outsider, new BigDecimal("50")));

            assertThatThrownBy(() -> service.createSplits(expense, splits))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when the same participant appears twice")
        void throwsOnDuplicateParticipant() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend")));
            List<SplitParticipantRequest> splits = List.of(
                    participant(friendId, new BigDecimal("20")),
                    participant(friendId, new BigDecimal("20")));

            assertThatThrownBy(() -> service.createSplits(expense, splits))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("throws when total shares exceed the expense amount")
        void throwsWhenSharesExceedAmount() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend")));
            List<SplitParticipantRequest> splits = List.of(participant(friendId, new BigDecimal("150")));

            assertThatThrownBy(() -> service.createSplits(expense, splits))
                    .isInstanceOf(BusinessException.class);
            verify(splitRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("allows total shares exactly equal to the expense amount (boundary)")
        void allowsSharesEqualToAmount() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend")));
            List<SplitParticipantRequest> splits = List.of(participant(friendId, new BigDecimal("100")));

            service.createSplits(expense, splits);

            verify(splitRepository).saveAll(any());
        }

        @Test
        @DisplayName("saves one ExpenseSplit per participant with the payer/family/expense fields correctly populated")
        void savesSplitsWithCorrectFields() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            UUID friend2 = UUID.randomUUID();
            when(userRepository.findByFamilyId(familyId))
                    .thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend"), userOf(friend2, "Friend2")));
            List<SplitParticipantRequest> splits = List.of(
                    participant(friendId, new BigDecimal("30")),
                    participant(friend2, new BigDecimal("20")));

            service.createSplits(expense, splits);

            ArgumentCaptor<List<ExpenseSplit>> captor = ArgumentCaptor.forClass(List.class);
            verify(splitRepository).saveAll(captor.capture());
            List<ExpenseSplit> saved = captor.getValue();
            assertThat(saved).hasSize(2);
            assertThat(saved).allSatisfy(s -> {
                assertThat(s.getExpenseId()).isEqualTo(expenseId);
                assertThat(s.getFamilyId()).isEqualTo(familyId);
                assertThat(s.getPayerUserId()).isEqualTo(payerId);
            });
            assertThat(saved).extracting(ExpenseSplit::getParticipantUserId).containsExactlyInAnyOrder(friendId, friend2);
        }
    }

    // ─── getMySplits ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getMySplits")
    class GetMySplitsTests {

        @Test
        @DisplayName("empty when the user has no pending splits either way")
        void emptyWhenNoSplits() {
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());

            MySplitsResponse response = service.getMySplits(payerId);

            assertThat(response.getBalances()).isEmpty();
            assertThat(response.getPending()).isEmpty();
        }

        @Test
        @DisplayName("money owed TO the user nets positive for that counterpart")
        void owedToMeNetsPositive() {
            ExpenseSplit split = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(split));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(expenseRepository.findAllById(Set.of(expenseId))).thenReturn(List.of());
            when(userRepository.findAllById(any())).thenReturn(List.of(userOf(friendId, "Friend")));

            MySplitsResponse response = service.getMySplits(payerId);

            SplitBalanceResponse balance = response.getBalances().get(0);
            assertThat(balance.getCounterpartUserId()).isEqualTo(friendId);
            assertThat(balance.getNetAmount()).isEqualByComparingTo("50");
        }

        @Test
        @DisplayName("money the user owes nets negative for that counterpart")
        void iOweNetsNegative() {
            ExpenseSplit split = ExpenseSplit.builder().expenseId(expenseId).payerUserId(friendId)
                    .participantUserId(payerId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(split));
            when(expenseRepository.findAllById(Set.of(expenseId))).thenReturn(List.of());
            when(userRepository.findAllById(any())).thenReturn(List.of(userOf(friendId, "Friend")));

            MySplitsResponse response = service.getMySplits(payerId);

            assertThat(response.getBalances().get(0).getNetAmount()).isEqualByComparingTo("-50");
        }

        @Test
        @DisplayName("nets owed-to-me and I-owe against the same counterpart into a single combined balance")
        void nettedAgainstSameCounterpart() {
            UUID expense2 = UUID.randomUUID();
            ExpenseSplit owedToMe = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("80")).status(SplitStatus.PENDING).build();
            ExpenseSplit iOwe = ExpenseSplit.builder().expenseId(expense2).payerUserId(friendId)
                    .participantUserId(payerId).shareAmount(new BigDecimal("30")).status(SplitStatus.PENDING).build();
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(owedToMe));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(iOwe));
            when(expenseRepository.findAllById(any())).thenReturn(List.of(
                    expenseOf(payerId, familyId, new BigDecimal("80")),
                    resolvableExpense(expense2, friendId, familyId, new BigDecimal("30"))));
            when(userRepository.findAllById(any())).thenReturn(List.of(userOf(friendId, "Friend")));

            MySplitsResponse response = service.getMySplits(payerId);

            assertThat(response.getBalances()).hasSize(1);
            assertThat(response.getBalances().get(0).getNetAmount()).isEqualByComparingTo("50"); // 80 - 30
        }

        @Test
        @DisplayName("a counterpart with a net balance of exactly zero is excluded from the balances list")
        void zeroNetBalanceExcluded() {
            UUID otherExpenseId = UUID.randomUUID();
            ExpenseSplit owedToMe = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();
            ExpenseSplit iOwe = ExpenseSplit.builder().expenseId(otherExpenseId).payerUserId(friendId)
                    .participantUserId(payerId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(owedToMe));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(iOwe));
            when(expenseRepository.findAllById(any())).thenReturn(List.of(
                    expenseOf(payerId, familyId, new BigDecimal("50")),
                    resolvableExpense(otherExpenseId, friendId, familyId, new BigDecimal("50"))));
            when(userRepository.findAllById(any())).thenReturn(List.of());

            MySplitsResponse response = service.getMySplits(payerId);

            assertThat(response.getBalances()).isEmpty();
            assertThat(response.getPending()).hasSize(2); // still listed as pending items
        }

        @Test
        @DisplayName("balances are sorted by absolute net amount, largest first")
        void balancesSortedByAbsoluteAmountDescending() {
            UUID smallCounterpart = UUID.randomUUID();
            UUID bigCounterpart   = UUID.randomUUID();
            UUID smallExpenseId = UUID.randomUUID();
            UUID bigExpenseId = UUID.randomUUID();
            ExpenseSplit small = ExpenseSplit.builder().expenseId(smallExpenseId).payerUserId(payerId)
                    .participantUserId(smallCounterpart).shareAmount(new BigDecimal("10")).status(SplitStatus.PENDING).build();
            ExpenseSplit big = ExpenseSplit.builder().expenseId(bigExpenseId).payerUserId(payerId)
                    .participantUserId(bigCounterpart).shareAmount(new BigDecimal("500")).status(SplitStatus.PENDING).build();
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(small, big));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(expenseRepository.findAllById(any())).thenReturn(List.of(
                    resolvableExpense(smallExpenseId, payerId, familyId, new BigDecimal("10")),
                    resolvableExpense(bigExpenseId, payerId, familyId, new BigDecimal("500"))));
            when(userRepository.findAllById(any())).thenReturn(List.of());

            MySplitsResponse response = service.getMySplits(payerId);

            assertThat(response.getBalances()).extracting(SplitBalanceResponse::getCounterpartUserId)
                    .containsExactly(bigCounterpart, smallCounterpart);
        }

        @Test
        @DisplayName("resolves expense description/category from the preloaded map for a resolvable split")
        void resolvesExpenseDetails() {
            UUID catId = UUID.randomUUID();
            Expense expense = Expense.builder().userId(payerId).familyId(familyId).categoryId(catId)
                    .amount(new BigDecimal("100")).description("Dinner").expenseDate(LocalDate.now()).build();
            ReflectionTestUtils.setField(expense, "id", expenseId);
            Category cat = Category.builder().name("Food").type(CategoryType.EXPENSE).build();
            ReflectionTestUtils.setField(cat, "id", catId);

            ExpenseSplit withExpense = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();

            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(withExpense));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(expenseRepository.findAllById(Set.of(expenseId))).thenReturn(List.of(expense));
            when(categoryRepository.findAllById(Set.of(catId))).thenReturn(List.of(cat));
            when(userRepository.findAllById(any())).thenReturn(List.of(userOf(friendId, "Friend")));

            MySplitsResponse response = service.getMySplits(payerId);

            var resp = response.getPending().get(0);
            assertThat(resp.getExpenseDescription()).isEqualTo("Dinner");
            assertThat(resp.getCategoryName()).isEqualTo("Food");
        }

        @Test
        @DisplayName("KNOWN BUG: an orphaned split (its expense no longer resolves) throws NPE instead of degrading gracefully")
        void orphanedSplitThrowsNpeOnSort() {
            // toResponse() sets expenseDate=null when the expense can't be found in the preloaded
            // map (e.g. deleted), but getMySplits' final sort — `b.getExpenseDate().compareTo(...)`
            // — has no null guard. Any pending list containing an orphaned split alongside a normal
            // one crashes the whole endpoint instead of just showing the orphaned row with blanks.
            // This test documents current behavior; it is not a desired outcome.
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            UUID missingExpenseId = UUID.randomUUID();
            ExpenseSplit withExpense = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();
            ExpenseSplit orphaned = ExpenseSplit.builder().expenseId(missingExpenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("20")).status(SplitStatus.PENDING).build();

            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(withExpense, orphaned));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(expenseRepository.findAllById(Set.of(expenseId, missingExpenseId))).thenReturn(List.of(expense));
            when(userRepository.findAllById(any())).thenReturn(List.of(userOf(friendId, "Friend")));

            assertThatThrownBy(() -> service.getMySplits(payerId))
                    .isInstanceOf(NullPointerException.class);
        }

        @Test
        @DisplayName("unresolvable counterpart names default to 'Unknown' rather than null or an exception")
        void unresolvedNameDefaultsToUnknown() {
            ExpenseSplit split = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("50")).status(SplitStatus.PENDING).build();
            when(splitRepository.findByPayerUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of(split));
            when(splitRepository.findByParticipantUserIdAndStatus(payerId, SplitStatus.PENDING)).thenReturn(List.of());
            when(expenseRepository.findAllById(any())).thenReturn(List.of());
            when(userRepository.findAllById(any())).thenReturn(List.of()); // friend's name unresolved

            MySplitsResponse response = service.getMySplits(payerId);

            assertThat(response.getBalances().get(0).getCounterpartName()).isEqualTo("Unknown");
            assertThat(response.getPending().get(0).getParticipantName()).isEqualTo("Unknown");
        }
    }

    // ─── settleSplit ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("settleSplit")
    class SettleSplitTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the split does not exist")
        void throwsWhenNotFound() {
            UUID splitId = UUID.randomUUID();
            when(splitRepository.findById(splitId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.settleSplit(splitId, payerId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException when the caller is neither payer nor participant")
        void throwsWhenNotInvolved() {
            UUID splitId = UUID.randomUUID();
            ExpenseSplit split = ExpenseSplit.builder().payerUserId(payerId).participantUserId(friendId).build();
            when(splitRepository.findById(splitId)).thenReturn(Optional.of(split));

            assertThatThrownBy(() -> service.settleSplit(splitId, UUID.randomUUID()))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("the payer can settle their own split")
        void payerCanSettle() {
            UUID splitId = UUID.randomUUID();
            ExpenseSplit split = ExpenseSplit.builder().payerUserId(payerId).participantUserId(friendId).build();
            when(splitRepository.findById(splitId)).thenReturn(Optional.of(split));

            service.settleSplit(splitId, payerId);

            assertThat(split.getStatus()).isEqualTo(SplitStatus.SETTLED);
            assertThat(split.getSettledAt()).isNotNull();
            verify(splitRepository).save(split);
        }

        @Test
        @DisplayName("the participant can also settle the split")
        void participantCanSettle() {
            UUID splitId = UUID.randomUUID();
            ExpenseSplit split = ExpenseSplit.builder().payerUserId(payerId).participantUserId(friendId).build();
            when(splitRepository.findById(splitId)).thenReturn(Optional.of(split));

            service.settleSplit(splitId, friendId);

            assertThat(split.getStatus()).isEqualTo(SplitStatus.SETTLED);
        }
    }

    // ─── settleWithCounterpart ───────────────────────────────────────────────────

    @Test
    @DisplayName("settleWithCounterpart delegates to the bulk settle-between repository query")
    void settleWithCounterpartDelegates() {
        UUID counterpartId = UUID.randomUUID();

        service.settleWithCounterpart(payerId, counterpartId);

        verify(splitRepository).settleBetween(eq(payerId), eq(counterpartId), any());
    }

    // ─── getSplitsForExpense ─────────────────────────────────────────────────────

    @Nested
    @DisplayName("getSplitsForExpense")
    class GetSplitsForExpenseTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the expense does not exist")
        void throwsWhenExpenseNotFound() {
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getSplitsForExpense(expenseId, payerId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's expense")
        void throwsWhenNotOwner() {
            Expense expense = expenseOf(UUID.randomUUID(), familyId, new BigDecimal("100"));
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));

            assertThatThrownBy(() -> service.getSplitsForExpense(expenseId, payerId))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("returns an empty list when the expense has no splits, without touching category/user lookups")
        void emptyWhenNoSplits() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(splitRepository.findByExpenseId(expenseId)).thenReturn(List.of());

            List<com.wealthynest.domain.expensesplit.dto.response.ExpenseSplitResponse> result =
                    service.getSplitsForExpense(expenseId, payerId);

            assertThat(result).isEmpty();
            verifyNoInteractions(categoryRepository, userRepository);
        }

        @Test
        @DisplayName("resolves category name and participant/payer names for each split on the expense")
        void resolvesDetailsForEachSplit() {
            UUID catId = UUID.randomUUID();
            Expense expense = Expense.builder().userId(payerId).familyId(familyId).categoryId(catId)
                    .amount(new BigDecimal("100")).description("Dinner").expenseDate(LocalDate.now()).build();
            ReflectionTestUtils.setField(expense, "id", expenseId);
            Category cat = Category.builder().name("Food").type(CategoryType.EXPENSE).build();
            ReflectionTestUtils.setField(cat, "id", catId);
            ExpenseSplit split = ExpenseSplit.builder().expenseId(expenseId).payerUserId(payerId)
                    .participantUserId(friendId).shareAmount(new BigDecimal("40")).status(SplitStatus.PENDING).build();

            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(splitRepository.findByExpenseId(expenseId)).thenReturn(List.of(split));
            when(categoryRepository.findById(catId)).thenReturn(Optional.of(cat));
            when(userRepository.findAllById(any())).thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend")));

            var result = service.getSplitsForExpense(expenseId, payerId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCategoryName()).isEqualTo("Food");
            assertThat(result.get(0).getParticipantName()).isEqualTo("Friend");
            assertThat(result.get(0).getShareAmount()).isEqualByComparingTo("40");
        }
    }

    // ─── addSplits ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("addSplits")
    class AddSplitsTests {

        @Test
        @DisplayName("no-op when splitWith is null or empty")
        void noOpWhenEmpty() {
            service.addSplits(expenseId, payerId, null);
            service.addSplits(expenseId, payerId, List.of());

            verifyNoInteractions(expenseRepository);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's expense")
        void throwsWhenNotOwner() {
            Expense expense = expenseOf(UUID.randomUUID(), familyId, new BigDecimal("100"));
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            List<SplitParticipantRequest> splits = List.of(participant(friendId, new BigDecimal("20")));

            assertThatThrownBy(() -> service.addSplits(expenseId, payerId, splits))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("throws when the new batch, ADDED TO what's already split, would exceed the expense amount")
        void throwsWhenCombinedSharesExceedAmount() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(splitRepository.sumSharesByExpenseId(expenseId)).thenReturn(new BigDecimal("70"));
            List<SplitParticipantRequest> splits = List.of(participant(friendId, new BigDecimal("40"))); // 70+40 > 100

            assertThatThrownBy(() -> service.addSplits(expenseId, payerId, splits))
                    .isInstanceOf(BusinessException.class);
            verify(splitRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("allows a new batch that exactly fills the remaining unsplit amount")
        void allowsBatchFillingRemainder() {
            Expense expense = expenseOf(payerId, familyId, new BigDecimal("100"));
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(splitRepository.sumSharesByExpenseId(expenseId)).thenReturn(new BigDecimal("70"));
            when(userRepository.findByFamilyId(familyId)).thenReturn(List.of(userOf(payerId, "Payer"), userOf(friendId, "Friend")));
            List<SplitParticipantRequest> splits = List.of(participant(friendId, new BigDecimal("30")));

            service.addSplits(expenseId, payerId, splits);

            verify(splitRepository).saveAll(any());
        }
    }

    // ─── validateAmountCoversSplits ──────────────────────────────────────────────

    @Nested
    @DisplayName("validateAmountCoversSplits")
    class ValidateAmountCoversSplitsTests {

        @Test
        @DisplayName("throws when the new amount is less than the total already-split shares")
        void throwsWhenAmountTooLow() {
            when(splitRepository.sumSharesByExpenseId(expenseId)).thenReturn(new BigDecimal("100"));

            assertThatThrownBy(() -> service.validateAmountCoversSplits(expenseId, new BigDecimal("50")))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("allows a new amount equal to or greater than the total split shares")
        void allowsSufficientAmount() {
            when(splitRepository.sumSharesByExpenseId(expenseId)).thenReturn(new BigDecimal("100"));

            service.validateAmountCoversSplits(expenseId, new BigDecimal("100"));
            service.validateAmountCoversSplits(expenseId, new BigDecimal("150"));
            // no exception
        }
    }
}
