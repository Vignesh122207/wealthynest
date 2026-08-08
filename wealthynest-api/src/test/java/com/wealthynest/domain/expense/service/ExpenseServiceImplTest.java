package com.wealthynest.domain.expense.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.account.service.AccountBalanceGuard;
import com.wealthynest.domain.account.service.AccountOwnershipGuard;
import com.wealthynest.domain.account.service.WalletAccountService;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.category.service.CategoryOwnershipGuard;
import com.wealthynest.domain.expense.dto.request.CreateExpenseRequest;
import com.wealthynest.domain.expense.dto.request.UpdateExpenseRequest;
import com.wealthynest.domain.expense.dto.response.ExpenseResponse;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.mapper.ExpenseMapper;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import com.wealthynest.domain.expensesplit.service.ExpenseSplitService;
import com.wealthynest.domain.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceImplTest {

    @Mock private ExpenseRepository       expenseRepository;
    @Mock private CategoryRepository      categoryRepository;
    @Mock private ExpenseMapper           expenseMapper;
    @Mock private BudgetRepository        budgetRepository;
    @Mock private NotificationService     notificationService;
    @Mock private AccountOwnershipGuard   accountOwnershipGuard;
    @Mock private AccountBalanceGuard     accountBalanceGuard;
    @Mock private WalletAccountService    walletAccountService;
    @Mock private ExpenseSplitService     expenseSplitService;
    @Mock private CategoryOwnershipGuard  categoryOwnershipGuard;

    @InjectMocks
    private ExpenseServiceImpl service;

    private final UUID userId     = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();
    private final UUID accountId  = UUID.randomUUID();
    private final UUID expenseId  = UUID.randomUUID();

    private Expense withId(Expense e) {
        ReflectionTestUtils.setField(e, "id", expenseId);
        return e;
    }

    private Expense.ExpenseBuilder baseExpense() {
        return Expense.builder().userId(userId).categoryId(categoryId).accountId(accountId)
                .amount(new BigDecimal("100")).expenseDate(LocalDate.now());
    }

    private CreateExpenseRequest createRequest(BigDecimal amount, List<?> splitWith) {
        CreateExpenseRequest req = mock(CreateExpenseRequest.class);
        lenient().when(req.getCategoryId()).thenReturn(categoryId);
        lenient().when(req.getAccountId()).thenReturn(accountId);
        lenient().when(req.getAmount()).thenReturn(amount);
        lenient().when(req.getBudgetId()).thenReturn(null);
        lenient().when(req.getExpenseDate()).thenReturn(LocalDate.now());
        lenient().when(req.getSplitWith()).thenReturn((List) splitWith);
        return req;
    }

    @BeforeEach
    void stubMapperAndEnrichment() {
        lenient().when(expenseMapper.toEntity(any())).thenAnswer(inv -> Expense.builder().build());
        lenient().when(expenseMapper.toResponse(any(Expense.class))).thenAnswer(inv -> {
            Expense e = inv.getArgument(0);
            return ExpenseResponse.builder().id(e.getId()).categoryId(e.getCategoryId())
                    .amount(e.getAmount()).build();
        });
        lenient().when(categoryRepository.findById(any())).thenReturn(Optional.empty());
    }

    // ─── createExpense ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("createExpense")
    class CreateExpenseTests {

        @Test
        @DisplayName("validates category ownership, account ownership, and balance sufficiency before saving")
        void validatesOwnershipAndBalance() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of());

            service.createExpense(userId, null, req);

            verify(categoryOwnershipGuard).validateCategoryOwnership(categoryId, userId, null);
            verify(accountOwnershipGuard).validateAccountOwnership(accountId, userId);
            verify(accountBalanceGuard).validateSufficientBalance(accountId, userId, new BigDecimal("100"), BigDecimal.ZERO);
        }

        @Test
        @DisplayName("persists userId/familyId/budgetId/accountId onto the mapped entity")
        void persistsOwnershipFields() {
            UUID familyId = UUID.randomUUID();
            UUID budgetId = UUID.randomUUID();
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(req.getBudgetId()).thenReturn(budgetId);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(budgetRepository.findByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(List.of());

            service.createExpense(userId, familyId, req);

            var captor = org.mockito.ArgumentCaptor.forClass(Expense.class);
            verify(expenseRepository).save(captor.capture());
            assertThat(captor.getValue().getUserId()).isEqualTo(userId);
            assertThat(captor.getValue().getFamilyId()).isEqualTo(familyId);
            assertThat(captor.getValue().getBudgetId()).isEqualTo(budgetId);
            assertThat(captor.getValue().getAccountId()).isEqualTo(accountId);
        }

        @Test
        @DisplayName("triggers a low-balance check on the debited account after saving")
        void triggersLowBalanceCheck() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of());

            service.createExpense(userId, null, req);

            verify(walletAccountService).checkLowBalance(accountId, userId);
        }

        @Test
        @DisplayName("delegates split creation to ExpenseSplitService with the saved expense and requested splits")
        void delegatesSplitCreation() {
            List<Object> splits = List.of(new Object());
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), splits);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of());

            service.createExpense(userId, null, req);

            verify(expenseSplitService).createSplits(any(Expense.class), eq((List) splits));
        }

        @Test
        @DisplayName("a MONTHLY budget at/above its alert threshold triggers a budget-breach notification")
        void monthlyBudgetBreachTriggersNotification() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            Budget budget = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000"))
                    .budgetType(BudgetType.MONTHLY).alertThreshold(new BigDecimal("80")).build();
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of(budget));
            LocalDate today = LocalDate.now();
            when(expenseRepository.sumByUserCategoryAndMonth(userId, categoryId, today.getYear(), today.getMonthValue()))
                    .thenReturn(new BigDecimal("900"));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(
                    Category.builder().name("Groceries").type(CategoryType.EXPENSE).build()));

            service.createExpense(userId, null, req);

            verify(notificationService).createBudgetBreachNotification(
                    eq(userId), eq("Groceries"), eq("MONTHLY"), eq(new BigDecimal("900")), eq(new BigDecimal("1000")), eq(90.0));
        }

        @Test
        @DisplayName("no notification when spend is below the alert threshold")
        void belowThresholdNoNotification() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            Budget budget = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000"))
                    .budgetType(BudgetType.MONTHLY).alertThreshold(new BigDecimal("80")).build();
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of(budget));
            when(expenseRepository.sumByUserCategoryAndMonth(eq(userId), eq(categoryId), anyInt(), anyInt()))
                    .thenReturn(new BigDecimal("500"));

            service.createExpense(userId, null, req);

            verify(notificationService, never()).createBudgetBreachNotification(any(), any(), any(), any(), any(), anyDouble());
        }

        @Test
        @DisplayName("a zero-amount budget is skipped entirely (no divide-by-zero, no notification)")
        void zeroBudgetAmountSkipped() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            Budget budget = Budget.builder().categoryId(categoryId).amount(BigDecimal.ZERO)
                    .budgetType(BudgetType.MONTHLY).build();
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of(budget));

            service.createExpense(userId, null, req); // must not throw

            verify(notificationService, never()).createBudgetBreachNotification(any(), any(), any(), any(), any(), anyDouble());
        }

        @Test
        @DisplayName("a YEARLY budget is compared against the year's total spend, not the month's")
        void yearlyBudgetUsesYearSum() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            Budget budget = Budget.builder().categoryId(categoryId).amount(new BigDecimal("10000"))
                    .budgetType(BudgetType.YEARLY).alertThreshold(new BigDecimal("80")).build();
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of(budget));
            when(expenseRepository.sumByUserCategoryAndYear(eq(userId), eq(categoryId), anyInt()))
                    .thenReturn(new BigDecimal("9000"));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(
                    Category.builder().name("Travel").type(CategoryType.EXPENSE).build()));

            service.createExpense(userId, null, req);

            verify(notificationService).createBudgetBreachNotification(
                    eq(userId), eq("Travel"), eq("YEARLY"), eq(new BigDecimal("9000")), eq(new BigDecimal("10000")), eq(90.0));
            verify(expenseRepository, never()).sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt());
        }

        @Test
        @DisplayName("family-shared budgets are checked (and summed) using the family scope, not the acting user's own")
        void familyScopedBudgetCheck() {
            UUID familyId = UUID.randomUUID();
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            Budget budget = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000"))
                    .budgetType(BudgetType.MONTHLY).alertThreshold(new BigDecimal("80")).build();
            when(budgetRepository.findByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(List.of(budget));
            when(expenseRepository.sumByFamilyCategoryAndMonth(eq(familyId), eq(categoryId), anyInt(), anyInt()))
                    .thenReturn(new BigDecimal("950"));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(
                    Category.builder().name("Groceries").type(CategoryType.EXPENSE).build()));

            service.createExpense(userId, familyId, req);

            verify(budgetRepository, never()).findByUserIdAndCategoryId(any(), any());
            verify(notificationService).createBudgetBreachNotification(any(), any(), any(), any(), any(), anyDouble());
        }

        @Test
        @DisplayName("a failure while computing ONE budget's spend/notification is swallowed per-budget, so a later budget in the same list still gets checked")
        void perBudgetCheckFailureIsSwallowedAndLaterBudgetsStillRun() {
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            Budget broken = Budget.builder().categoryId(categoryId).amount(new BigDecimal("1000"))
                    .budgetType(BudgetType.MONTHLY).alertThreshold(new BigDecimal("80")).build();
            Budget healthy = Budget.builder().categoryId(categoryId).amount(new BigDecimal("2000"))
                    .budgetType(BudgetType.YEARLY).alertThreshold(new BigDecimal("80")).build();
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of(broken, healthy));
            // MONTHLY branch (for `broken`) throws; YEARLY branch (for `healthy`) still succeeds.
            when(expenseRepository.sumByUserCategoryAndMonth(eq(userId), eq(categoryId), anyInt(), anyInt()))
                    .thenThrow(new RuntimeException("DB blip"));
            when(expenseRepository.sumByUserCategoryAndYear(eq(userId), eq(categoryId), anyInt()))
                    .thenReturn(new BigDecimal("1900"));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(
                    Category.builder().name("Groceries").type(CategoryType.EXPENSE).build()));

            ExpenseResponse response = service.createExpense(userId, null, req); // must not throw

            assertThat(response).isNotNull();
            verify(notificationService).createBudgetBreachNotification(
                    eq(userId), eq("Groceries"), eq("YEARLY"), eq(new BigDecimal("1900")), eq(new BigDecimal("2000")), eq(95.0));
        }

        @Test
        @DisplayName("KNOWN GAP: a failure fetching the budget LIST itself (outside the per-budget try/catch) propagates and fails expense creation")
        void budgetListFetchFailureIsNotSwallowed() {
            // The try/catch inside checkBudgetBreach only wraps the per-budget loop body — the
            // budgetRepository.findByUserIdAndCategoryId/findByFamilyIdAndCategoryId call that
            // produces the list to iterate is NOT inside it. A DB blip there currently takes down
            // the whole createExpense call, not just the "best-effort" notification step. This test
            // documents that current behavior; it is not a desired outcome.
            CreateExpenseRequest req = createRequest(new BigDecimal("100"), null);
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> withId(inv.getArgument(0)));
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId))
                    .thenThrow(new RuntimeException("DB blip"));

            assertThatThrownBy(() -> service.createExpense(userId, null, req))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessage("DB blip");
        }
    }

    // ─── updateExpense ───────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateExpense")
    class UpdateExpenseTests {

        @Test
        @DisplayName("throws when the expense does not exist or isn't owned")
        void throwsWhenNotFoundOrNotOwned() {
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.empty());
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            assertThatThrownBy(() -> service.updateExpense(expenseId, userId, req))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("throws AccessDeniedException for another user's expense")
        void throwsWhenNotOwned() {
            Expense expense = withId(baseExpense().userId(UUID.randomUUID()).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            assertThatThrownBy(() -> service.updateExpense(expenseId, userId, req))
                    .isInstanceOf(AccessDeniedException.class);
        }

        @Test
        @DisplayName("changing categoryId re-validates ownership using the EXPENSE's familyId, not a request param")
        void categoryChangeUsesExpenseFamilyId() {
            UUID familyId = UUID.randomUUID();
            UUID newCategoryId = UUID.randomUUID();
            Expense expense = withId(baseExpense().familyId(familyId).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getCategoryId()).thenReturn(newCategoryId);

            service.updateExpense(expenseId, userId, req);

            verify(categoryOwnershipGuard).validateCategoryOwnership(newCategoryId, userId, familyId);
            assertThat(expense.getCategoryId()).isEqualTo(newCategoryId);
        }

        @Test
        @DisplayName("changing the amount validates split coverage and account balance using the previous amount")
        void amountChangeValidatesSplitsAndBalance() {
            Expense expense = withId(baseExpense().amount(new BigDecimal("100")).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getAmount()).thenReturn(new BigDecimal("150"));

            service.updateExpense(expenseId, userId, req);

            verify(expenseSplitService).validateAmountCoversSplits(expenseId, new BigDecimal("150"));
            verify(accountBalanceGuard).validateSufficientBalance(accountId, userId, new BigDecimal("150"), new BigDecimal("100"));
        }

        @Test
        @DisplayName("changing the accountId re-validates ownership and moves the expense, checking the NEW account fresh")
        void accountChangeValidatesOwnershipAndBalance() {
            UUID newAccountId = UUID.randomUUID();
            Expense expense = withId(baseExpense().amount(new BigDecimal("100")).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getAccountId()).thenReturn(newAccountId);

            service.updateExpense(expenseId, userId, req);

            verify(accountOwnershipGuard).validateAccountOwnership(newAccountId, userId);
            assertThat(expense.getAccountId()).isEqualTo(newAccountId);
            // Fresh check (previousAmount=ZERO) — the new account never had this expense counted
            // against it, unlike an in-place amount edit which offsets the account's own prior amount.
            verify(accountBalanceGuard).validateSufficientBalance(newAccountId, userId, new BigDecimal("100"), BigDecimal.ZERO);
        }

        @Test
        @DisplayName("re-sending the same accountId is a no-op — no ownership re-check, no balance re-validation")
        void unchangedAccountIdSkipsValidation() {
            Expense expense = withId(baseExpense().build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getAccountId()).thenReturn(accountId);

            service.updateExpense(expenseId, userId, req);

            verifyNoInteractions(accountOwnershipGuard);
            verifyNoInteractions(accountBalanceGuard);
        }

        @Test
        @DisplayName("leaving the amount unchanged skips split-coverage and balance validation entirely")
        void unchangedAmountSkipsValidation() {
            Expense expense = withId(baseExpense().build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getDescription()).thenReturn("Updated note");

            service.updateExpense(expenseId, userId, req);

            verifyNoInteractions(expenseSplitService);
            verifyNoInteractions(accountBalanceGuard);
        }

        @Test
        @DisplayName("only updates fields present in the request (partial update)")
        void partialUpdate() {
            Expense expense = withId(baseExpense().description("Original").build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getNotes()).thenReturn("A note");

            service.updateExpense(expenseId, userId, req);

            assertThat(expense.getDescription()).isEqualTo("Original"); // unchanged
            assertThat(expense.getNotes()).isEqualTo("A note");
        }

        @Test
        @DisplayName("sets latitude/longitude when the request captures a location")
        void setsLocationWhenProvided() {
            Expense expense = withId(baseExpense().build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getLatitude()).thenReturn(12.9716);
            when(req.getLongitude()).thenReturn(77.5946);

            service.updateExpense(expenseId, userId, req);

            assertThat(expense.getLatitude()).isEqualTo(12.9716);
            assertThat(expense.getLongitude()).isEqualTo(77.5946);
        }

        @Test
        @DisplayName("leaves an existing location untouched when the request doesn't include one")
        void leavesLocationUnchangedWhenAbsent() {
            Expense expense = withId(baseExpense().latitude(12.9716).longitude(77.5946).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getNotes()).thenReturn("A note");
            // Mockito's default answer special-cases boxed numeric types (Double/Integer/etc.) to
            // their zero value rather than null (unlike ordinary reference types like BigDecimal),
            // so an unstubbed getLatitude()/getLongitude() would return 0.0 here, not null — stub
            // explicit nulls to represent what a real "location not included" request carries.
            when(req.getLatitude()).thenReturn(null);
            when(req.getLongitude()).thenReturn(null);

            service.updateExpense(expenseId, userId, req);

            assertThat(expense.getLatitude()).isEqualTo(12.9716);
            assertThat(expense.getLongitude()).isEqualTo(77.5946);
        }

        // Regression: a request with clearLocation unset/false and no latitude/longitude is
        // structurally identical, over the wire, to a request that's explicitly asking to remove a
        // location — both arrive as "latitude/longitude simply absent from the JSON body" (the
        // frontend can't send an "unset" numeric field any other way). Without this flag, the
        // null-check partial-update pattern used for every other field silently treats "clear it"
        // the same as "didn't touch it", leaving the old location stuck forever.
        @Test
        @DisplayName("clearLocation=true removes an existing location even though latitude/longitude are absent from the request")
        void clearLocationRemovesExistingLocation() {
            Expense expense = withId(baseExpense().latitude(12.9716).longitude(77.5946).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
            UpdateExpenseRequest req = mock(UpdateExpenseRequest.class);
            when(req.getClearLocation()).thenReturn(true);

            service.updateExpense(expenseId, userId, req);

            assertThat(expense.getLatitude()).isNull();
            assertThat(expense.getLongitude()).isNull();
        }
    }

    // ─── deleteExpense / getExpense ──────────────────────────────────────────────

    @Nested
    @DisplayName("deleteExpense / getExpense")
    class DeleteAndGetTests {

        @Test
        @DisplayName("deleteExpense throws when not found or not owned, otherwise deletes")
        void deleteExpenseOwnershipEnforced() {
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.deleteExpense(expenseId, userId)).isInstanceOf(ResourceNotFoundException.class);

            Expense expense = withId(baseExpense().build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            service.deleteExpense(expenseId, userId);
            verify(expenseRepository).delete(expense);
        }

        @Test
        @DisplayName("getExpense enriches the response with category name/icon/color when resolvable")
        void getExpenseEnrichesCategory() {
            Expense expense = withId(baseExpense().build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(
                    Category.builder().name("Groceries").icon("cart").color("#22c55e").type(CategoryType.EXPENSE).build()));

            ExpenseResponse response = service.getExpense(expenseId, userId);

            assertThat(response.getCategoryName()).isEqualTo("Groceries");
        }

        // Regression: buildResponse() (the branch enrich() takes when the category DOES resolve —
        // i.e. almost always, in real usage) manually reconstructs ExpenseResponse field-by-field
        // via its builder. It's a real bug pattern: adding a field to ExpenseResponse/Expense isn't
        // enough on its own — buildResponse() silently drops any field not explicitly copied there,
        // even though expenseMapper.toResponse() (and the other tests in this file, which stub
        // categoryRepository.findById() to return empty by default and so never hit this branch)
        // mapped it correctly. latitude/longitude were dropped exactly this way until this test.
        @Test
        @DisplayName("getExpense's category-enriched response still carries every other field (regression: buildResponse used to silently drop fields it didn't explicitly copy)")
        void getExpenseEnrichmentPreservesAllFields() {
            Expense expense = withId(baseExpense().debt(true).latitude(12.9716).longitude(77.5946).build());
            when(expenseRepository.findById(expenseId)).thenReturn(Optional.of(expense));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(
                    Category.builder().name("Groceries").icon("cart").color("#22c55e").type(CategoryType.EXPENSE).build()));
            when(expenseMapper.toResponse(expense)).thenReturn(ExpenseResponse.builder()
                    .id(expenseId).categoryId(categoryId).amount(expense.getAmount())
                    .debt(true).latitude(12.9716).longitude(77.5946).build());

            ExpenseResponse response = service.getExpense(expenseId, userId);

            assertThat(response.isDebt()).isTrue();
            assertThat(response.getLatitude()).isEqualTo(12.9716);
            assertThat(response.getLongitude()).isEqualTo(77.5946);
        }
    }
}
