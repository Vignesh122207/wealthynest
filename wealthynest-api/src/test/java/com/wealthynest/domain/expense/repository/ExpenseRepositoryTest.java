package com.wealthynest.domain.expense.repository;

import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import com.wealthynest.domain.category.entity.Category;
import com.wealthynest.domain.category.entity.CategoryType;
import com.wealthynest.domain.expense.entity.Expense;
import com.wealthynest.domain.expense.service.ExpenseSpecifications;
import com.wealthynest.domain.family.entity.Family;
import com.wealthynest.domain.user.entity.User;
import com.wealthynest.testsupport.AbstractRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs every custom @Query against a real Postgres (via AbstractRepositoryTest), not H2 — the
 * point is to catch a wrong JPQL translation, a sargability regression, or a filter that's
 * present on one sibling query but silently missing on another, none of which a mocked
 * repository in the service-layer tests could ever have caught.
 */
class ExpenseRepositoryTest extends AbstractRepositoryTest {

    @Autowired private TestEntityManager entityManager;
    @Autowired private ExpenseRepository expenseRepository;

    private UUID userId;
    private UUID categoryId;

    @BeforeEach
    void seedUserAndCategory() {
        User user = User.builder().fullName("Alice").email("alice-" + UUID.randomUUID() + "@x.com")
                .passwordHash("hash").build();
        entityManager.persist(user);
        userId = user.getId();

        Category category = Category.builder().userId(userId).name("Groceries").type(CategoryType.EXPENSE).build();
        entityManager.persist(category);
        categoryId = category.getId();

        entityManager.flush();
    }

    private Expense persistExpense(BigDecimal amount, LocalDate date, boolean debt) {
        Expense e = Expense.builder().userId(userId).categoryId(categoryId).amount(amount)
                .expenseDate(date).debt(debt).build();
        entityManager.persist(e);
        return e;
    }

    // ─── date-range boundary correctness ─────────────────────────────────────────

    @Nested
    @DisplayName("month/year date-range boundaries")
    class DateRangeBoundaryTests {

        @Test
        @DisplayName("includes an expense dated exactly on the 1st of the month, excludes one dated the 1st of the next month")
        void monthRangeIsInclusiveStartExclusiveEnd() {
            persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 1), false);   // in range
            persistExpense(new BigDecimal("200"), LocalDate.of(2026, 6, 30), false);  // in range
            persistExpense(new BigDecimal("999"), LocalDate.of(2026, 7, 1), false);   // NOT in range
            entityManager.flush();

            BigDecimal sum = expenseRepository.sumByUserAndMonth(userId, 2026, 6);

            assertThat(sum).isEqualByComparingTo("300");
        }

        @Test
        @DisplayName("year range includes Jan 1 through Dec 31, excludes the following Jan 1")
        void yearRangeIsInclusiveStartExclusiveEnd() {
            persistExpense(new BigDecimal("100"), LocalDate.of(2026, 1, 1), false);
            persistExpense(new BigDecimal("200"), LocalDate.of(2026, 12, 31), false);
            persistExpense(new BigDecimal("999"), LocalDate.of(2027, 1, 1), false);
            entityManager.flush();

            BigDecimal sum = expenseRepository.sumByUserCategoryAndYear(userId, categoryId, 2026);

            assertThat(sum).isEqualByComparingTo("300");
        }
    }

    // ─── debt-flag filtering: month and year sums now agree ─────────────────────

    @Nested
    @DisplayName("debt-flag filtering (both month and year sums exclude debt)")
    class DebtFilterTests {

        @Test
        @DisplayName("monthly category sum excludes debt-tagged expenses")
        void monthlySumExcludesDebt() {
            persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            persistExpense(new BigDecimal("500"), LocalDate.of(2026, 6, 6), true); // a debt repayment
            entityManager.flush();

            BigDecimal sum = expenseRepository.sumByUserCategoryAndMonth(userId, categoryId, 2026, 6);

            assertThat(sum).isEqualByComparingTo("100");
        }

        @Test
        @DisplayName("yearly category sum (used for YEARLY budgets) also excludes debt-tagged expenses, " +
                "consistent with the monthly sum on the same category")
        void yearlySumExcludesDebtConsistentlyWithMonthlySum() {
            persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            persistExpense(new BigDecimal("500"), LocalDate.of(2026, 6, 6), true);
            entityManager.flush();

            BigDecimal yearSum = expenseRepository.sumByUserCategoryAndYear(userId, categoryId, 2026);

            assertThat(yearSum).isEqualByComparingTo("100"); // the debt row is excluded here too
        }
    }

    // ─── grouping queries ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("grouping queries")
    class GroupingTests {

        @Test
        @DisplayName("findCategorySpendingByUser groups by category and orders by spend descending")
        void groupsByCategoryDescending() {
            Category otherCategory = Category.builder().userId(userId).name("Dining").type(CategoryType.EXPENSE).build();
            entityManager.persist(otherCategory);
            entityManager.flush();

            persistExpense(new BigDecimal("50"), LocalDate.of(2026, 6, 5), false);   // Groceries: 50
            Expense diningExpense = Expense.builder().userId(userId).categoryId(otherCategory.getId())
                    .amount(new BigDecimal("300")).expenseDate(LocalDate.of(2026, 6, 6)).build();
            entityManager.persist(diningExpense); // Dining: 300
            entityManager.flush();

            List<Object[]> rows = expenseRepository.findCategorySpendingByUser(userId, 2026, 6);

            assertThat(rows).hasSize(2);
            assertThat(rows.get(0)[0]).isEqualTo(otherCategory.getId()); // Dining (300) ranks first
            assertThat(((BigDecimal) rows.get(0)[1])).isEqualByComparingTo("300");
        }

        @Test
        @DisplayName("sumByUserAndYearGroupedByMonth's MONTH() JPQL function translates correctly against Postgres")
        void groupedByMonthUsesRealPostgresMonthFunction() {
            persistExpense(new BigDecimal("100"), LocalDate.of(2026, 3, 15), false);
            persistExpense(new BigDecimal("200"), LocalDate.of(2026, 3, 20), false);
            persistExpense(new BigDecimal("50"), LocalDate.of(2026, 7, 1), false);
            entityManager.flush();

            List<Object[]> rows = expenseRepository.sumByUserAndYearGroupedByMonth(userId, 2026);

            var march = rows.stream().filter(r -> ((Number) r[0]).intValue() == 3).findFirst().orElseThrow();
            assertThat((BigDecimal) march[1]).isEqualByComparingTo("300");
        }
    }

    // ─── modifying queries ───────────────────────────────────────────────────────

    @Nested
    @DisplayName("modifying queries")
    class ModifyingQueryTests {

        @Test
        @DisplayName("clearBudgetId nulls the budget reference on every expense pointing to it")
        void clearBudgetIdNullsReference() {
            Budget budget = Budget.builder().userId(userId).categoryId(categoryId)
                    .amount(new BigDecimal("1000")).budgetType(BudgetType.MONTHLY).build();
            entityManager.persist(budget);
            Expense e = persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            e.setBudgetId(budget.getId());
            entityManager.persist(e);
            entityManager.flush();
            entityManager.clear();

            expenseRepository.clearBudgetId(budget.getId());
            entityManager.flush();
            entityManager.clear();

            Expense reloaded = entityManager.find(Expense.class, e.getId());
            assertThat(reloaded.getBudgetId()).isNull();
        }

        @Test
        @DisplayName("clearBudgetIdByCategory nulls budget references via a category-scoped subquery")
        void clearBudgetIdByCategoryUsesSubquery() {
            Budget budget = Budget.builder().userId(userId).categoryId(categoryId)
                    .amount(new BigDecimal("1000")).budgetType(BudgetType.MONTHLY).build();
            entityManager.persist(budget);
            Expense e = persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            e.setBudgetId(budget.getId());
            entityManager.persist(e);
            entityManager.flush();
            entityManager.clear();

            expenseRepository.clearBudgetIdByCategory(categoryId);
            entityManager.flush();
            entityManager.clear();

            Expense reloaded = entityManager.find(Expense.class, e.getId());
            assertThat(reloaded.getBudgetId()).isNull();
        }

        @Test
        @DisplayName("migrateUserExpensesToFamily only touches expenses with no existing familyId")
        void migrateOnlyTouchesUnassignedExpenses() {
            Family family = Family.builder().name("The Smiths").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(family);
            Family otherFamily = Family.builder().name("Other").inviteCode("CODE" + UUID.randomUUID().toString().substring(0, 6)).build();
            entityManager.persist(otherFamily);

            Expense unassigned = persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            Expense alreadyAssigned = persistExpense(new BigDecimal("200"), LocalDate.of(2026, 6, 6), false);
            alreadyAssigned.setFamilyId(otherFamily.getId());
            entityManager.persist(alreadyAssigned);
            entityManager.flush();
            entityManager.clear();

            expenseRepository.migrateUserExpensesToFamily(family.getId(), userId);
            entityManager.flush();
            entityManager.clear();

            assertThat(entityManager.find(Expense.class, unassigned.getId()).getFamilyId()).isEqualTo(family.getId());
            assertThat(entityManager.find(Expense.class, alreadyAssigned.getId()).getFamilyId()).isEqualTo(otherFamily.getId()); // untouched
        }
    }

    // ─── ExpenseSpecifications.filter search clause ─────────────────────────────
    // Regression coverage for the search predicate matching description-only: the Transactions
    // page's "All" tab already matched description/amount/category client-side, while this
    // server-scoped search (used by the paginated Expenses tab) silently didn't — same search box,
    // different results depending on which tab was open.

    @Nested
    @DisplayName("ExpenseSpecifications.filter — search matches description, amount, or category name")
    class SearchSpecificationTests {

        private Page<Expense> search(String term) {
            Specification<Expense> spec = ExpenseSpecifications.filter(
                    userId, null, null, null, term, null, null, null, null, null);
            return expenseRepository.findAll(spec, PageRequest.of(0, 10));
        }

        @Test
        @DisplayName("matches the expense description, case-insensitively")
        void matchesDescription() {
            Expense e = persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            e.setDescription("Uber ride home");
            entityManager.flush();

            assertThat(search("uber").getContent()).extracting(Expense::getId).containsExactly(e.getId());
        }

        @Test
        @DisplayName("matches the amount rendered as text")
        void matchesAmount() {
            persistExpense(new BigDecimal("100.00"), LocalDate.of(2026, 6, 5), false);
            Expense target = persistExpense(new BigDecimal("4250.00"), LocalDate.of(2026, 6, 6), false);
            entityManager.flush();

            assertThat(search("4250").getContent()).extracting(Expense::getId).containsExactly(target.getId());
        }

        @Test
        @DisplayName("matches the name of the expense's own category")
        void matchesCategoryName() {
            // categoryId (seeded in @BeforeEach) points at a category named "Groceries".
            Expense target = persistExpense(new BigDecimal("300"), LocalDate.of(2026, 6, 5), false);
            entityManager.flush();

            assertThat(search("grocer").getContent()).extracting(Expense::getId).containsExactly(target.getId());
        }

        @Test
        @DisplayName("excludes rows matching none of description, amount, or category name")
        void excludesNonMatches() {
            persistExpense(new BigDecimal("100"), LocalDate.of(2026, 6, 5), false);
            entityManager.flush();

            assertThat(search("no-such-term").getContent()).isEmpty();
        }
    }

    // ─── existsByCategoryId ──────────────────────────────────────────────────────

    @Test
    @DisplayName("existsByCategoryId reflects whether any expense references the category")
    void existsByCategoryIdReflectsReferences() {
        assertThat(expenseRepository.existsByCategoryId(categoryId)).isFalse();

        persistExpense(new BigDecimal("50"), LocalDate.of(2026, 6, 1), false);
        entityManager.flush();

        assertThat(expenseRepository.existsByCategoryId(categoryId)).isTrue();
    }
}
