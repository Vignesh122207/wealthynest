package com.wealthynest.domain.budget.repository;

import com.wealthynest.domain.budget.entity.Budget;
import com.wealthynest.domain.budget.entity.BudgetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BudgetRepository extends JpaRepository<Budget, UUID> {

    // Monthly budgets for a specific month
    List<Budget>     findByFamilyIdAndPeriodYearAndPeriodMonthAndBudgetType(UUID familyId, int year, int month, BudgetType type);
    Optional<Budget> findByFamilyIdAndCategoryIdAndPeriodYearAndPeriodMonthAndBudgetType(UUID familyId, UUID categoryId, int year, int month, BudgetType type);

    List<Budget>     findByUserIdAndPeriodYearAndPeriodMonthAndBudgetType(UUID userId, int year, int month, BudgetType type);
    Optional<Budget> findByUserIdAndCategoryIdAndPeriodYearAndPeriodMonthAndBudgetType(UUID userId, UUID categoryId, int year, int month, BudgetType type);

    // Yearly budgets (period_month = 0)
    List<Budget>     findByFamilyIdAndPeriodYearAndBudgetType(UUID familyId, int year, BudgetType type);
    Optional<Budget> findByFamilyIdAndCategoryIdAndPeriodYearAndBudgetType(UUID familyId, UUID categoryId, int year, BudgetType type);

    List<Budget>     findByUserIdAndPeriodYearAndBudgetType(UUID userId, int year, BudgetType type);
    Optional<Budget> findByUserIdAndCategoryIdAndPeriodYearAndBudgetType(UUID userId, UUID categoryId, int year, BudgetType type);

    // All budgets for a user (templates — no period filter)
    List<Budget> findByUserId(UUID userId);
    List<Budget> findByFamilyId(UUID familyId);

    // Find a specific template by category + type (for create-or-update)
    Optional<Budget> findByUserIdAndCategoryIdAndBudgetType(UUID userId, UUID categoryId, BudgetType type);
    Optional<Budget> findByFamilyIdAndCategoryIdAndBudgetType(UUID familyId, UUID categoryId, BudgetType type);

    // All budgets for a category (for expense-linking dropdown)
    List<Budget> findByUserIdAndCategoryId(UUID userId, UUID categoryId);

    @Modifying
    @Query("""
        UPDATE Budget b SET b.familyId = :familyId
        WHERE b.userId = :userId
        AND b.familyId IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM Budget e
            WHERE e.familyId = :familyId
            AND e.categoryId = b.categoryId
            AND e.budgetType = b.budgetType
        )
        """)
    void migrateUserBudgetsToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Budget b SET b.familyId = null WHERE b.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);
}
