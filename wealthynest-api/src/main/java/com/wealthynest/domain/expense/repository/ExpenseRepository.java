package com.wealthynest.domain.expense.repository;

import com.wealthynest.domain.expense.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID>, JpaSpecificationExecutor<Expense> {

    /** Cheap EXISTS check — used to decide whether an account has any history before allowing delete. */
    boolean existsByAccountId(UUID accountId);

    // Every year/month-scoped method below is a thin default wrapper around a date-range query.
    // expense_date is never wrapped in YEAR()/MONTH() inside a WHERE clause — doing so defeats
    // idx_expenses_user_date/idx_expenses_family_date (the planner can't range-scan a function of
    // the column), so all filtering here uses a plain >= / < range that the index can serve
    // directly. Public (year, month) signatures are kept so call sites don't change.

    private static LocalDate monthStart(int year, int month) { return LocalDate.of(year, month, 1); }
    private static LocalDate yearStart(int year)              { return LocalDate.of(year, 1, 1); }

    default BigDecimal sumByUserAndMonth(UUID userId, int year, int month) {
        LocalDate start = monthStart(year, month);
        return sumByUserAndDateRange(userId, start, start.plusMonths(1));
    }
    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false")
    BigDecimal sumByUserAndDateRange(@Param("userId") UUID userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    default BigDecimal sumByFamilyCategoryAndMonth(UUID familyId, UUID categoryId, int year, int month) {
        LocalDate start = monthStart(year, month);
        return sumByFamilyCategoryAndDateRange(familyId, categoryId, start, start.plusMonths(1));
    }
    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND e.categoryId = :categoryId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false")
    BigDecimal sumByFamilyCategoryAndDateRange(@Param("familyId") UUID familyId, @Param("categoryId") UUID categoryId,
                                                @Param("start") LocalDate start, @Param("end") LocalDate end);

    default BigDecimal sumByUserCategoryAndMonth(UUID userId, UUID categoryId, int year, int month) {
        LocalDate start = monthStart(year, month);
        return sumByUserCategoryAndDateRange(userId, categoryId, start, start.plusMonths(1));
    }
    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.categoryId = :categoryId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false")
    BigDecimal sumByUserCategoryAndDateRange(@Param("userId") UUID userId, @Param("categoryId") UUID categoryId,
                                              @Param("start") LocalDate start, @Param("end") LocalDate end);

    default List<Object[]> findCategorySpendingByUser(UUID userId, int year, int month) {
        LocalDate start = monthStart(year, month);
        return findCategorySpendingByUserAndDateRange(userId, start, start.plusMonths(1));
    }
    @Query("SELECT e.categoryId, SUM(e.amount) FROM Expense e WHERE e.userId = :userId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false GROUP BY e.categoryId ORDER BY SUM(e.amount) DESC")
    List<Object[]> findCategorySpendingByUserAndDateRange(@Param("userId") UUID userId,
                                                           @Param("start") LocalDate start, @Param("end") LocalDate end);

    default BigDecimal sumByUserCategoryAndYear(UUID userId, UUID categoryId, int year) {
        LocalDate start = yearStart(year);
        return sumByUserCategoryAndDateRangeAll(userId, categoryId, start, start.plusYears(1));
    }
    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.categoryId = :categoryId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false")
    BigDecimal sumByUserCategoryAndDateRangeAll(@Param("userId") UUID userId, @Param("categoryId") UUID categoryId,
                                                 @Param("start") LocalDate start, @Param("end") LocalDate end);

    default BigDecimal sumByFamilyCategoryAndYear(UUID familyId, UUID categoryId, int year) {
        LocalDate start = yearStart(year);
        return sumByFamilyCategoryAndDateRangeAll(familyId, categoryId, start, start.plusYears(1));
    }
    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND e.categoryId = :categoryId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false")
    BigDecimal sumByFamilyCategoryAndDateRangeAll(@Param("familyId") UUID familyId, @Param("categoryId") UUID categoryId,
                                                   @Param("start") LocalDate start, @Param("end") LocalDate end);

    /** Batched equivalent of sumByUserCategoryAndYear for a full budget list — avoids one query per budget. */
    default List<Object[]> sumByUserAndYearGroupedByCategory(UUID userId, int year) {
        LocalDate start = yearStart(year);
        return sumByUserAndDateRangeGroupedByCategory(userId, start, start.plusYears(1));
    }
    @Query("SELECT e.categoryId, COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.expenseDate >= :start AND e.expenseDate < :end GROUP BY e.categoryId")
    List<Object[]> sumByUserAndDateRangeGroupedByCategory(@Param("userId") UUID userId,
                                                           @Param("start") LocalDate start, @Param("end") LocalDate end);

    /** Batched equivalent of sumByUserAndMonth across a year — one query instead of 12 for a trend view.
     * MONTH() in the SELECT/GROUP BY is fine (it's what makes this a per-month breakdown) — only the
     * WHERE-clause range below needs to stay sargable, which it now is. */
    default List<Object[]> sumByUserAndYearGroupedByMonth(UUID userId, int year) {
        LocalDate start = yearStart(year);
        return sumByUserAndDateRangeGroupedByMonth(userId, start, start.plusYears(1));
    }
    @Query("SELECT MONTH(e.expenseDate), COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false GROUP BY MONTH(e.expenseDate)")
    List<Object[]> sumByUserAndDateRangeGroupedByMonth(@Param("userId") UUID userId,
                                                        @Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.accountId = :accountId")
    BigDecimal sumByAccountId(UUID accountId);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.accountId = :accountId AND e.debt = false")
    BigDecimal sumRegularByAccountId(UUID accountId);

    /** Batched equivalent of sumByAccountId for list views — one grouped query instead of N. */
    @Query("SELECT e.accountId, COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.accountId IN :accountIds GROUP BY e.accountId")
    List<Object[]> sumByAccountIdsGrouped(@Param("accountIds") Collection<UUID> accountIds);

    @Query("SELECT e.accountId, COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.accountId IN :accountIds AND e.debt = false GROUP BY e.accountId")
    List<Object[]> sumRegularByAccountIdsGrouped(@Param("accountIds") Collection<UUID> accountIds);

    List<Expense> findTop5ByAccountIdAndDebtFalseOrderByExpenseDateDesc(UUID accountId);
    List<Expense> findAllByAccountIdOrderByExpenseDateDesc(UUID accountId);

    default List<Expense> findByUserAndMonth(UUID userId, int year, int month) {
        LocalDate start = monthStart(year, month);
        return findByUserAndDateRange(userId, start, start.plusMonths(1));
    }
    @Query("SELECT e FROM Expense e WHERE e.userId = :userId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false ORDER BY e.expenseDate DESC")
    List<Expense> findByUserAndDateRange(@Param("userId") UUID userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    default List<Expense> findByUserAndYear(UUID userId, int year) {
        LocalDate start = yearStart(year);
        return findByUserAndDateRangeAll(userId, start, start.plusYears(1));
    }
    @Query("SELECT e FROM Expense e WHERE e.userId = :userId AND e.expenseDate >= :start AND e.expenseDate < :end AND e.debt = false ORDER BY e.expenseDate DESC")
    List<Expense> findByUserAndDateRangeAll(@Param("userId") UUID userId, @Param("start") LocalDate start, @Param("end") LocalDate end);

    List<Expense> findAllByRecurringTrue();

    /** Candidates for the daily anomaly sweep — expenses entered since the last run. */
    List<Expense> findByCreatedAtAfterAndDebtFalse(Instant since);

    /** Trailing average + sample size for one user+category, excluding the candidate expense itself
     * (row[0] = average amount, row[1] = sample count) — used to judge if a new expense is unusual. */
    @Query("SELECT COALESCE(AVG(e.amount),0), COUNT(e) FROM Expense e " +
           "WHERE e.userId = :userId AND e.categoryId = :categoryId AND e.debt = false " +
           "AND e.expenseDate BETWEEN :start AND :end AND e.id <> :excludeId")
    List<Object[]> avgAndCountByUserCategoryAndDateRangeExcluding(
            @Param("userId") UUID userId, @Param("categoryId") UUID categoryId,
            @Param("start") LocalDate start, @Param("end") LocalDate end, @Param("excludeId") UUID excludeId);

    boolean existsByCategoryId(UUID categoryId);

    /** Used for permanent account erasure — must run before assets/wallet_accounts cascade so
     * budget_id/account_id/category_id references never dangle. */
    void deleteByUserId(UUID userId);

    /** budget_id has no ON DELETE policy — must be cleared before the budget it points to is deleted. */
    @Modifying
    @Query("UPDATE Expense e SET e.budgetId = null WHERE e.budgetId = :budgetId")
    void clearBudgetId(@Param("budgetId") UUID budgetId);

    @Modifying
    @Query("UPDATE Expense e SET e.familyId = :familyId WHERE e.userId = :userId AND e.familyId IS NULL")
    void migrateUserExpensesToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Expense e SET e.familyId = null WHERE e.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);

    /** Detaches one departing member's own expenses from the family (removes them from family views). */
    @Modifying
    @Query("UPDATE Expense e SET e.familyId = null WHERE e.userId = :userId AND e.familyId = :familyId")
    void clearFamilyIdForUser(@Param("userId") UUID userId, @Param("familyId") UUID familyId);

    /** Clears expense links to every budget of a category, so those budgets can be deleted with the category. */
    @Modifying
    @Query("UPDATE Expense e SET e.budgetId = null WHERE e.budgetId IN (SELECT b.id FROM Budget b WHERE b.categoryId = :categoryId)")
    void clearBudgetIdByCategory(@Param("categoryId") UUID categoryId);
}
