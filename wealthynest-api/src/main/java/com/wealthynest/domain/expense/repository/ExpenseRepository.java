package com.wealthynest.domain.expense.repository;

import com.wealthynest.domain.expense.entity.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByUserAndMonth(UUID userId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByFamilyCategoryAndMonth(UUID familyId, UUID categoryId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByUserCategoryAndMonth(UUID userId, UUID categoryId, int year, int month);

    @Query("SELECT e.categoryId, SUM(e.amount) FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false GROUP BY e.categoryId ORDER BY SUM(e.amount) DESC")
    List<Object[]> findCategorySpendingByUser(UUID userId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year")
    BigDecimal sumByUserCategoryAndYear(UUID userId, UUID categoryId, int year);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year")
    BigDecimal sumByFamilyCategoryAndYear(UUID familyId, UUID categoryId, int year);

    /** Batched equivalent of sumByUserCategoryAndYear for a full budget list — avoids one query per budget. */
    @Query("SELECT e.categoryId, COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year GROUP BY e.categoryId")
    List<Object[]> sumByUserAndYearGroupedByCategory(@Param("userId") UUID userId, @Param("year") int year);

    /** Batched equivalent of sumByUserAndMonth across a year — one query instead of 12 for a trend view. */
    @Query("SELECT MONTH(e.expenseDate), COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND e.debt = false GROUP BY MONTH(e.expenseDate)")
    List<Object[]> sumByUserAndYearGroupedByMonth(@Param("userId") UUID userId, @Param("year") int year);

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

    @Query("SELECT e FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false ORDER BY e.expenseDate DESC")
    List<Expense> findByUserAndMonth(@Param("userId") UUID userId, @Param("year") int year, @Param("month") int month);

    @Query("SELECT e FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND e.debt = false ORDER BY e.expenseDate DESC")
    List<Expense> findByUserAndYear(@Param("userId") UUID userId, @Param("year") int year);

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

    @Modifying
    @Query("UPDATE Expense e SET e.accountId = null WHERE e.accountId = :accountId")
    void clearAccountId(@Param("accountId") UUID accountId);

    /** Used instead of clearAccountId when the user opts to delete a closed account's expenses
     * outright rather than keep them as detached history. */
    void deleteByAccountId(UUID accountId);

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
