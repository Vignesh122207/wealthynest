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
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, UUID>, JpaSpecificationExecutor<Expense> {

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByUserAndMonth(UUID userId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByFamilyAndMonth(UUID familyId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByFamilyCategoryAndMonth(UUID familyId, UUID categoryId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false")
    BigDecimal sumByUserCategoryAndMonth(UUID userId, UUID categoryId, int year, int month);

    @Query("SELECT e.categoryId, SUM(e.amount) FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false GROUP BY e.categoryId ORDER BY SUM(e.amount) DESC")
    List<Object[]> findCategorySpendingByUser(UUID userId, int year, int month);

    @Query("SELECT e.categoryId, SUM(e.amount) FROM Expense e WHERE e.familyId = :familyId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false GROUP BY e.categoryId ORDER BY SUM(e.amount) DESC")
    List<Object[]> findCategorySpendingByFamily(UUID familyId, int year, int month);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.userId = :userId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year")
    BigDecimal sumByUserCategoryAndYear(UUID userId, UUID categoryId, int year);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.familyId = :familyId AND e.categoryId = :categoryId AND YEAR(e.expenseDate) = :year")
    BigDecimal sumByFamilyCategoryAndYear(UUID familyId, UUID categoryId, int year);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.accountId = :accountId")
    BigDecimal sumByAccountId(UUID accountId);

    @Query("SELECT COALESCE(SUM(e.amount),0) FROM Expense e WHERE e.accountId = :accountId AND e.debt = false")
    BigDecimal sumRegularByAccountId(UUID accountId);

    List<Expense> findTop5ByAccountIdAndDebtFalseOrderByExpenseDateDesc(UUID accountId);
    List<Expense> findTop5ByAccountIdAndDebtTrueOrderByExpenseDateDesc(UUID accountId);
    List<Expense> findAllByAccountIdOrderByExpenseDateDesc(UUID accountId);

    @Query("SELECT e FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND MONTH(e.expenseDate) = :month AND e.debt = false ORDER BY e.expenseDate DESC")
    List<Expense> findByUserAndMonth(@Param("userId") UUID userId, @Param("year") int year, @Param("month") int month);

    @Query("SELECT e FROM Expense e WHERE e.userId = :userId AND YEAR(e.expenseDate) = :year AND e.debt = false ORDER BY e.expenseDate DESC")
    List<Expense> findByUserAndYear(@Param("userId") UUID userId, @Param("year") int year);

    List<Expense> findAllByRecurringTrue();

    @Modifying
    @Query("UPDATE Expense e SET e.accountId = null WHERE e.accountId = :accountId")
    void clearAccountId(@Param("accountId") UUID accountId);

    @Modifying
    @Query("UPDATE Expense e SET e.familyId = :familyId WHERE e.userId = :userId AND e.familyId IS NULL")
    void migrateUserExpensesToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Expense e SET e.familyId = null WHERE e.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);
}
