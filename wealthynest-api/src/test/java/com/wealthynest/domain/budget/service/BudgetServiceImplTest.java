package com.wealthynest.domain.budget.service;

import com.wealthynest.common.exception.AccessDeniedException;
import com.wealthynest.common.exception.ResourceNotFoundException;
import com.wealthynest.domain.budget.dto.request.CreateBudgetRequest;
import com.wealthynest.domain.budget.dto.request.UpdateBudgetRequest;
import com.wealthynest.domain.budget.dto.response.BudgetResponse;
import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.budget.mapper.BudgetMapper;
import com.wealthynest.domain.budget.repository.BudgetRepository;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.category.repository.CategoryRepository;
import com.wealthynest.domain.category.service.CategoryOwnershipGuard;
import com.wealthynest.domain.expense.repository.ExpenseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BudgetServiceImplTest {

    @Mock private BudgetRepository        budgetRepository;
    @Mock private CategoryRepository      categoryRepository;
    @Mock private ExpenseRepository       expenseRepository;
    @Mock private BudgetMapper            budgetMapper;
    @Mock private CategoryOwnershipGuard  categoryOwnershipGuard;

    @InjectMocks
    private BudgetServiceImpl service;

    private final UUID userId     = UUID.randomUUID();
    private final UUID familyId   = UUID.randomUUID();
    private final UUID categoryId = UUID.randomUUID();
    private final UUID budgetId   = UUID.randomUUID();

    private final int thisYear  = LocalDate.now().getYear();
    private final int thisMonth = LocalDate.now().getMonthValue();

    // ── Shared factory helpers ────────────────────────────────────────────────────

    private Budget buildBudget(UUID owner, UUID family, BudgetType type, BigDecimal amount, BigDecimal threshold) {
        Budget budget = Budget.builder()
                .userId(owner).familyId(family).categoryId(categoryId)
                .amount(amount).budgetType(type).alertThreshold(threshold)
                .periodMonth(0).periodYear(0)
                .build();
        ReflectionTestUtils.setField(budget, "id", budgetId);
        return budget;
    }

    private Category buildCategory() {
        Category category = Category.builder()
                .name("Groceries").icon("cart").color("#22c55e")
                .type(CategoryType.EXPENSE).build();
        ReflectionTestUtils.setField(category, "id", categoryId);
        return category;
    }

    /** Lenient: early-exit tests (ownership/not-found failures) never read every field. */
    private CreateBudgetRequest createRequest(BigDecimal amount, BudgetType type, BigDecimal threshold) {
        CreateBudgetRequest request = mock(CreateBudgetRequest.class);
        org.mockito.Mockito.lenient().when(request.getCategoryId()).thenReturn(categoryId);
        org.mockito.Mockito.lenient().when(request.getAmount()).thenReturn(amount);
        org.mockito.Mockito.lenient().when(request.getBudgetType()).thenReturn(type);
        org.mockito.Mockito.lenient().when(request.getAlertThreshold()).thenReturn(threshold);
        return request;
    }

    /** Lenient: early-exit tests (ownership/not-found failures) never read every field. */
    private UpdateBudgetRequest updateRequest(BigDecimal amount, BigDecimal threshold, UUID newCategoryId) {
        UpdateBudgetRequest request = mock(UpdateBudgetRequest.class);
        org.mockito.Mockito.lenient().when(request.getAmount()).thenReturn(amount);
        org.mockito.Mockito.lenient().when(request.getAlertThreshold()).thenReturn(threshold);
        org.mockito.Mockito.lenient().when(request.getCategoryId()).thenReturn(newCategoryId);
        return request;
    }

    /** Mirrors BudgetMapper#toResponse's real (unmapped) fields — spent/remaining/pct are
     * left for enrich() to fill in, exactly like the real MapStruct implementation does. */
    private BudgetResponse mapperResponseFor(Budget budget) {
        return BudgetResponse.builder()
                .id(budget.getId()).categoryId(budget.getCategoryId())
                .amount(budget.getAmount()).budgetType(budget.getBudgetType())
                .alertThreshold(budget.getAlertThreshold())
                .shared(budget.getFamilyId() != null)
                .build();
    }

    @BeforeEach
    void stubMapperToMirrorRealBehaviour() {
        // lenient: not every test exercises the mapper (e.g. early-exit ownership failures)
        org.mockito.Mockito.lenient().when(budgetMapper.toResponse(any(Budget.class)))
                .thenAnswer(inv -> mapperResponseFor(inv.getArgument(0)));
    }

    // ─── createOrUpdateBudget ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("createOrUpdateBudget")
    class CreateOrUpdateBudgetTests {

        @Test
        @DisplayName("creates a new personal MONTHLY budget when none exists for the category+type")
        void createsNewPersonalBudget() {
            CreateBudgetRequest request = createRequest(new BigDecimal("5000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.MONTHLY))
                    .thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(eq(userId), eq(categoryId), anyInt(), anyInt()))
                    .thenReturn(new BigDecimal("1000"));
            when(expenseRepository.sumByUserCategoryAndYear(eq(userId), eq(categoryId), anyInt()))
                    .thenReturn(new BigDecimal("1000"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            verify(categoryOwnershipGuard).validateCategoryOwnership(categoryId, userId, null);
            ArgumentCaptor<Budget> saved = ArgumentCaptor.forClass(Budget.class);
            verify(budgetRepository).save(saved.capture());
            assertThat(saved.getValue().getUserId()).isEqualTo(userId);
            assertThat(saved.getValue().getFamilyId()).isNull();
            assertThat(saved.getValue().getCategoryId()).isEqualTo(categoryId);
            assertThat(saved.getValue().getAmount()).isEqualByComparingTo("5000");
            assertThat(saved.getValue().getBudgetType()).isEqualTo(BudgetType.MONTHLY);
            assertThat(response.getSpent()).isEqualByComparingTo("1000");
            assertThat(response.getRemaining()).isEqualByComparingTo("4000");
            assertThat(response.isShared()).isFalse();
        }

        @Test
        @DisplayName("updates the existing budget in place instead of creating a duplicate")
        void updatesExistingBudgetInsteadOfDuplicating() {
            Budget existing = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("3000"), new BigDecimal("80"));
            CreateBudgetRequest request = createRequest(new BigDecimal("6000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.MONTHLY))
                    .thenReturn(Optional.of(existing));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);

            service.createOrUpdateBudget(userId, null, request);

            ArgumentCaptor<Budget> saved = ArgumentCaptor.forClass(Budget.class);
            verify(budgetRepository).save(saved.capture());
            assertThat(saved.getValue().getId()).isEqualTo(budgetId);
            assertThat(saved.getValue().getAmount()).isEqualByComparingTo("6000");
        }

        @Test
        @DisplayName("defaults budgetType to MONTHLY when the request omits it")
        void defaultsToMonthlyWhenTypeOmitted() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), null, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.MONTHLY))
                    .thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);

            service.createOrUpdateBudget(userId, null, request);

            verify(budgetRepository).findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.MONTHLY);
        }

        @Test
        @DisplayName("creates a family-shared budget when the caller belongs to a family")
        void createsFamilySharedBudget() {
            CreateBudgetRequest request = createRequest(new BigDecimal("10000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByFamilyIdAndCategoryIdAndBudgetType(familyId, categoryId, BudgetType.MONTHLY))
                    .thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByFamilyCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByFamilyCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);

            BudgetResponse response = service.createOrUpdateBudget(userId, familyId, request);

            verify(categoryOwnershipGuard).validateCategoryOwnership(categoryId, userId, familyId);
            verify(budgetRepository, never()).findByUserIdAndCategoryIdAndBudgetType(any(), any(), any());
            ArgumentCaptor<Budget> saved = ArgumentCaptor.forClass(Budget.class);
            verify(budgetRepository).save(saved.capture());
            assertThat(saved.getValue().getFamilyId()).isEqualTo(familyId);
            assertThat(response.isShared()).isTrue();
        }

        @Test
        @DisplayName("uses the YEARLY branch (year sum only) when budgetType is YEARLY")
        void yearlyBudgetUsesYearSumOnly() {
            CreateBudgetRequest request = createRequest(new BigDecimal("50000"), BudgetType.YEARLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(userId, categoryId, BudgetType.YEARLY))
                    .thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndYear(eq(userId), eq(categoryId), anyInt()))
                    .thenReturn(new BigDecimal("12000"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            verify(expenseRepository, never()).sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt());
            assertThat(response.getSpent()).isEqualByComparingTo("12000");
            assertThat(response.getAnnualSpent()).isEqualByComparingTo("12000");
        }

        @Test
        @DisplayName("propagates category-ownership failure and never saves the budget")
        void propagatesOwnershipFailure() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, null);
            org.mockito.Mockito.doThrow(new AccessDeniedException("Category does not belong to you"))
                    .when(categoryOwnershipGuard).validateCategoryOwnership(categoryId, userId, null);

            assertThatThrownBy(() -> service.createOrUpdateBudget(userId, null, request))
                    .isInstanceOf(AccessDeniedException.class);

            verify(budgetRepository, never()).save(any());
        }

        @Test
        @DisplayName("percentUsed is 0 and no divide-by-zero when spent is zero")
        void zeroSpentYieldsZeroPercent() {
            CreateBudgetRequest request = createRequest(new BigDecimal("2000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getPercentUsed()).isEqualTo(0.0);
            assertThat(response.isOverBudget()).isFalse();
            assertThat(response.isAlertTriggered()).isFalse();
        }

        @Test
        @DisplayName("percentUsed rounds HALF_UP to 2 effective decimals (100/300 -> 33.33%)")
        void percentUsedRoundsCorrectly() {
            CreateBudgetRequest request = createRequest(new BigDecimal("300"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("100"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("100"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getPercentUsed()).isEqualTo(33.33);
        }

        @Test
        @DisplayName("exactly 100% spent is NOT flagged overBudget (strictly greater-than check)")
        void exactlyOneHundredPercentIsNotOverBudget() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("1000"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("1000"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getPercentUsed()).isEqualTo(100.0);
            assertThat(response.isOverBudget()).isFalse();
        }

        @Test
        @DisplayName("spend above the budget amount is flagged overBudget once the rounded percentage clears 100")
        void overspendIsFlaggedOverBudget() {
            // percentUsed is rounded to 4 decimal places on the ratio (2 on the %) before the >100
            // compare, so the overage has to survive that rounding to register — 1000.01/1000 rounds
            // right back down to exactly 100.00%, which is why 1000.06 (-> 100.01%) is used here.
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("1000.06"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("1000.06"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getPercentUsed()).isEqualTo(100.01);
            assertThat(response.isOverBudget()).isTrue();
            assertThat(response.getRemaining()).isEqualByComparingTo("-0.06");
        }

        @Test
        @DisplayName("a one-cent overage that rounds back down to exactly 100.00% is NOT flagged overBudget")
        void roundingCanMaskATinyOverspend() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("1000.01"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("1000.01"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getPercentUsed()).isEqualTo(100.0);
            assertThat(response.isOverBudget()).isFalse();
        }

        @Test
        @DisplayName("alertTriggered fires exactly at the threshold (>=), using the request's custom threshold")
        void alertTriggeredAtExactThreshold() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, new BigDecimal("50"));
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("500"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("500"));

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getPercentUsed()).isEqualTo(50.0);
            assertThat(response.isAlertTriggered()).isTrue();
        }

        @Test
        @DisplayName("falls back to an 80% default alert threshold when neither the request nor the mapper supplies one")
        void defaultsAlertThresholdTo80WhenAbsent() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("790"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("790"));
            // Override the default @BeforeEach stub: mapper returns a response with no threshold set,
            // simulating a freshly-built entity whose alertThreshold field wasn't populated.
            org.mockito.Mockito.reset(budgetMapper);
            when(budgetMapper.toResponse(any(Budget.class))).thenAnswer(inv -> {
                Budget b = inv.getArgument(0);
                return BudgetResponse.builder().id(b.getId()).categoryId(b.getCategoryId())
                        .amount(b.getAmount()).budgetType(b.getBudgetType()).alertThreshold(null).build();
            });

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getAlertThreshold()).isEqualByComparingTo("80");
            assertThat(response.isAlertTriggered()).isFalse(); // 79% < 80%
        }

        @Test
        @DisplayName("treats a null spend from the repository as zero (defensive null-safety)")
        void nullSpendTreatedAsZero() {
            CreateBudgetRequest request = createRequest(new BigDecimal("1000"), BudgetType.MONTHLY, null);
            when(budgetRepository.findByUserIdAndCategoryIdAndBudgetType(any(), any(), any())).thenReturn(Optional.empty());
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(null);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(null);

            BudgetResponse response = service.createOrUpdateBudget(userId, null, request);

            assertThat(response.getSpent()).isEqualByComparingTo("0");
            assertThat(response.getAnnualSpent()).isEqualByComparingTo("0");
            assertThat(response.getRemaining()).isEqualByComparingTo("1000");
        }
    }

    // ─── updateBudget ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("updateBudget")
    class UpdateBudgetTests {

        @Test
        @DisplayName("throws ResourceNotFoundException when the budget does not exist")
        void throwsWhenNotFound() {
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.empty());
            UpdateBudgetRequest request = updateRequest(new BigDecimal("100"), null, null);

            assertThatThrownBy(() -> service.updateBudget(budgetId, userId, null, request))
                    .isInstanceOf(ResourceNotFoundException.class);
            verify(budgetRepository, never()).save(any());
        }

        @Test
        @DisplayName("throws AccessDeniedException when caller owns neither the budget's user nor family")
        void throwsWhenNotOwned() {
            Budget budget = buildBudget(UUID.randomUUID(), null, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
            UpdateBudgetRequest request = updateRequest(new BigDecimal("200"), null, null);

            assertThatThrownBy(() -> service.updateBudget(budgetId, userId, null, request))
                    .isInstanceOf(AccessDeniedException.class);
            verify(budgetRepository, never()).save(any());
        }

        @Test
        @DisplayName("the original creator can still update via userId even with no active familyId passed")
        void creatorCanUpdateWithoutFamilyContext() {
            // Budget itself is family-linked, but the caller's *current* familyId argument is null —
            // enrich() branches on that argument, not on budget.getFamilyId(), so this exercises the
            // personal sum methods even though the budget row is family-shared.
            Budget budget = buildBudget(userId, familyId, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);
            UpdateBudgetRequest request = updateRequest(new BigDecimal("500"), null, null);

            service.updateBudget(budgetId, userId, null, request);

            verify(budgetRepository).save(any(Budget.class));
            verify(expenseRepository, never()).sumByFamilyCategoryAndMonth(any(), any(), anyInt(), anyInt());
        }

        @Test
        @DisplayName("any family member (not just the creator) can update a family-shared budget")
        void familyMemberCanUpdateSharedBudget() {
            UUID creator = UUID.randomUUID();
            UUID otherMember = UUID.randomUUID();
            Budget budget = buildBudget(creator, familyId, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByFamilyCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByFamilyCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);
            UpdateBudgetRequest request = updateRequest(new BigDecimal("500"), null, null);

            service.updateBudget(budgetId, otherMember, familyId, request);

            verify(budgetRepository).save(any(Budget.class));
        }

        @Test
        @DisplayName("only updates fields present in the request (partial update)")
        void partialUpdateOnlyTouchesProvidedFields() {
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);
            // amount omitted, threshold omitted, categoryId omitted -> nothing should change
            UpdateBudgetRequest request = updateRequest(null, null, null);

            service.updateBudget(budgetId, userId, null, request);

            ArgumentCaptor<Budget> saved = ArgumentCaptor.forClass(Budget.class);
            verify(budgetRepository).save(saved.capture());
            assertThat(saved.getValue().getAmount()).isEqualByComparingTo("100");
            assertThat(saved.getValue().getAlertThreshold()).isEqualByComparingTo("80");
            assertThat(saved.getValue().getCategoryId()).isEqualTo(categoryId);
            verify(categoryOwnershipGuard, never()).validateCategoryOwnership(any(), any(), any());
        }

        @Test
        @DisplayName("changing categoryId re-validates ownership of the new category")
        void categoryChangeRevalidatesOwnership() {
            UUID newCategoryId = UUID.randomUUID();
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
            when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
            when(categoryRepository.findById(any())).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);
            UpdateBudgetRequest request = updateRequest(null, null, newCategoryId);

            service.updateBudget(budgetId, userId, null, request);

            verify(categoryOwnershipGuard).validateCategoryOwnership(newCategoryId, userId, null);
            ArgumentCaptor<Budget> saved = ArgumentCaptor.forClass(Budget.class);
            verify(budgetRepository).save(saved.capture());
            assertThat(saved.getValue().getCategoryId()).isEqualTo(newCategoryId);
        }

        @Test
        @DisplayName("does not save when the new category fails ownership validation")
        void categoryChangeRejectedNeverSaves() {
            UUID newCategoryId = UUID.randomUUID();
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
            org.mockito.Mockito.doThrow(new AccessDeniedException("Category does not belong to you"))
                    .when(categoryOwnershipGuard).validateCategoryOwnership(newCategoryId, userId, null);
            UpdateBudgetRequest request = updateRequest(null, null, newCategoryId);

            assertThatThrownBy(() -> service.updateBudget(budgetId, userId, null, request))
                    .isInstanceOf(AccessDeniedException.class);
            verify(budgetRepository, never()).save(any());
        }
    }

    // ─── getBudgets ─────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("getBudgets")
    class GetBudgetsTests {

        @Test
        @DisplayName("personal scope: lists the caller's own budgets via findByUserId")
        void listsPersonalBudgets() {
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("1000"), new BigDecimal("80"));
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(budget));
            when(categoryRepository.findAllById(Set.of(categoryId))).thenReturn(List.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("250"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("250"));

            List<BudgetResponse> result = service.getBudgets(userId, null, thisYear, thisMonth);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCategoryName()).isEqualTo("Groceries");
            verify(budgetRepository, never()).findByFamilyId(any());
        }

        @Test
        @DisplayName("family scope: lists shared budgets via findByFamilyId and sums by family")
        void listsFamilyBudgets() {
            Budget budget = buildBudget(userId, familyId, BudgetType.MONTHLY, new BigDecimal("1000"), new BigDecimal("80"));
            when(budgetRepository.findByFamilyId(familyId)).thenReturn(List.of(budget));
            when(categoryRepository.findAllById(Set.of(categoryId))).thenReturn(List.of(buildCategory()));
            when(expenseRepository.sumByFamilyCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("400"));
            when(expenseRepository.sumByFamilyCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("400"));

            List<BudgetResponse> result = service.getBudgets(userId, familyId, thisYear, thisMonth);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getSpent()).isEqualByComparingTo("400");
            verify(budgetRepository, never()).findByUserId(any());
        }

        @Test
        @DisplayName("batches category lookups in a single findAllById call (no N+1)")
        void avoidsNPlusOneOnCategoryLookup() {
            UUID categoryId2 = UUID.randomUUID();
            Budget budget1 = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("1000"), new BigDecimal("80"));
            Budget budget2 = Budget.builder().userId(userId).categoryId(categoryId2)
                    .amount(new BigDecimal("500")).budgetType(BudgetType.MONTHLY).alertThreshold(new BigDecimal("80"))
                    .periodMonth(0).periodYear(0).build();
            ReflectionTestUtils.setField(budget2, "id", UUID.randomUUID());

            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(budget1, budget2));
            when(categoryRepository.findAllById(Set.of(categoryId, categoryId2))).thenReturn(List.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);

            service.getBudgets(userId, null, thisYear, thisMonth);

            verify(categoryRepository, times(1)).findAllById(any());
            verify(categoryRepository, never()).findById(any());
        }

        @Test
        @DisplayName("gracefully handles a budget whose category no longer resolves (null name/icon/color)")
        void handlesOrphanedCategoryGracefully() {
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("1000"), new BigDecimal("80"));
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(budget));
            when(categoryRepository.findAllById(Set.of(categoryId))).thenReturn(List.of()); // deleted category
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(BigDecimal.ZERO);
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(BigDecimal.ZERO);

            List<BudgetResponse> result = service.getBudgets(userId, null, thisYear, thisMonth);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getCategoryName()).isNull();
            assertThat(result.get(0).getCategoryIcon()).isNull();
        }

        @Test
        @DisplayName("returns an empty list without error when the caller has no budgets")
        void emptyListWhenNoBudgets() {
            when(budgetRepository.findByUserId(userId)).thenReturn(List.of());
            when(categoryRepository.findAllById(Set.of())).thenReturn(List.of());

            List<BudgetResponse> result = service.getBudgets(userId, null, thisYear, thisMonth);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("a YEARLY budget in the same list uses the year-sum branch, independent of any MONTHLY siblings")
        void mixedMonthlyAndYearlyBudgetsUseCorrectBranch() {
            Budget monthly = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("1000"), new BigDecimal("80"));
            UUID yearlyCategoryId = UUID.randomUUID();
            Budget yearly = Budget.builder().userId(userId).categoryId(yearlyCategoryId)
                    .amount(new BigDecimal("50000")).budgetType(BudgetType.YEARLY).alertThreshold(new BigDecimal("80"))
                    .periodMonth(0).periodYear(0).build();
            ReflectionTestUtils.setField(yearly, "id", UUID.randomUUID());

            when(budgetRepository.findByUserId(userId)).thenReturn(List.of(monthly, yearly));
            when(categoryRepository.findAllById(any())).thenReturn(List.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(eq(userId), eq(categoryId), anyInt(), anyInt())).thenReturn(new BigDecimal("100"));
            when(expenseRepository.sumByUserCategoryAndYear(eq(userId), eq(categoryId), anyInt())).thenReturn(new BigDecimal("1200"));
            when(expenseRepository.sumByUserCategoryAndYear(eq(userId), eq(yearlyCategoryId), anyInt())).thenReturn(new BigDecimal("30000"));

            List<BudgetResponse> result = service.getBudgets(userId, null, thisYear, thisMonth);

            BudgetResponse monthlyResponse = result.stream().filter(r -> r.getBudgetType() == BudgetType.MONTHLY).findFirst().orElseThrow();
            BudgetResponse yearlyResponse  = result.stream().filter(r -> r.getBudgetType() == BudgetType.YEARLY).findFirst().orElseThrow();
            assertThat(monthlyResponse.getSpent()).isEqualByComparingTo("100");
            assertThat(monthlyResponse.getAnnualSpent()).isEqualByComparingTo("1200");
            assertThat(yearlyResponse.getSpent()).isEqualByComparingTo("30000");
            verify(expenseRepository, never()).sumByUserCategoryAndMonth(eq(userId), eq(yearlyCategoryId), anyInt(), anyInt());
        }
    }

    // ─── getBudgetsForCategory ──────────────────────────────────────────────────────

    @Nested
    @DisplayName("getBudgetsForCategory")
    class GetBudgetsForCategoryTests {

        @Test
        @DisplayName("lists all budgets for a category, enriched as personal (familyId always null in this path)")
        void listsBudgetsForCategory() {
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("1000"), new BigDecimal("80"));
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of(budget));
            when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(buildCategory()));
            when(expenseRepository.sumByUserCategoryAndMonth(any(), any(), anyInt(), anyInt())).thenReturn(new BigDecimal("300"));
            when(expenseRepository.sumByUserCategoryAndYear(any(), any(), anyInt())).thenReturn(new BigDecimal("300"));

            List<BudgetResponse> result = service.getBudgetsForCategory(userId, categoryId, thisYear, thisMonth);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).getSpent()).isEqualByComparingTo("300");
        }

        @Test
        @DisplayName("returns an empty list when the category has no budgets")
        void emptyWhenNoBudgetsForCategory() {
            when(budgetRepository.findByUserIdAndCategoryId(userId, categoryId)).thenReturn(List.of());

            List<BudgetResponse> result = service.getBudgetsForCategory(userId, categoryId, thisYear, thisMonth);

            assertThat(result).isEmpty();
        }
    }

    // ─── deleteBudget ───────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("deleteBudget")
    class DeleteBudgetTests {

        @Test
        @DisplayName("throws ResourceNotFoundException and touches nothing when the budget doesn't exist")
        void throwsWhenNotFound() {
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.deleteBudget(budgetId, userId, null))
                    .isInstanceOf(ResourceNotFoundException.class);

            verify(expenseRepository, never()).clearBudgetId(any());
            verify(budgetRepository, never()).delete(any());
        }

        @Test
        @DisplayName("throws AccessDeniedException and touches nothing when the caller doesn't own the budget")
        void throwsWhenNotOwned() {
            Budget budget = buildBudget(UUID.randomUUID(), null, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));

            assertThatThrownBy(() -> service.deleteBudget(budgetId, userId, null))
                    .isInstanceOf(AccessDeniedException.class);

            verify(expenseRepository, never()).clearBudgetId(any());
            verify(budgetRepository, never()).delete(any());
        }

        @Test
        @DisplayName("clears the budget reference on expenses before deleting the budget itself, in order")
        void clearsExpenseReferenceBeforeDeleting() {
            Budget budget = buildBudget(userId, null, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));

            service.deleteBudget(budgetId, userId, null);

            InOrder order = inOrder(expenseRepository, budgetRepository);
            order.verify(expenseRepository).clearBudgetId(budgetId);
            order.verify(budgetRepository).delete(budget);
        }

        @Test
        @DisplayName("a family member can delete a family-shared budget")
        void familyMemberCanDeleteSharedBudget() {
            Budget budget = buildBudget(UUID.randomUUID(), familyId, BudgetType.MONTHLY, new BigDecimal("100"), new BigDecimal("80"));
            when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));

            service.deleteBudget(budgetId, UUID.randomUUID(), familyId);

            verify(budgetRepository).delete(budget);
        }
    }
}
