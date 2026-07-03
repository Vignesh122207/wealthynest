package com.wealthynest.domain.income.repository;

import com.wealthynest.domain.income.entity.IncomeEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface IncomeRepository extends JpaRepository<IncomeEntry, UUID> {
    List<IncomeEntry> findByUserIdAndDebtFalseOrderByIncomeDateDesc(UUID userId);
    List<IncomeEntry> findByUserIdOrderByIncomeDateDesc(UUID userId);
    List<IncomeEntry> findByUserIdAndPeriodYearAndPeriodMonthAndDebtFalseOrderByIncomeDateDesc(UUID userId, int year, int month);
    List<IncomeEntry> findByUserIdAndPeriodYearAndPeriodMonthOrderByIncomeDateDesc(UUID userId, int year, int month);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM IncomeEntry i WHERE i.userId = :userId AND i.periodYear = :year AND i.periodMonth = :month AND i.debt = false")
    BigDecimal sumByUserAndPeriod(UUID userId, int year, int month);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM IncomeEntry i WHERE i.accountId = :accountId")
    BigDecimal sumByAccountId(UUID accountId);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM IncomeEntry i WHERE i.accountId = :accountId AND i.debt = false")
    BigDecimal sumRegularByAccountId(UUID accountId);

    List<IncomeEntry> findTop5ByAccountIdAndDebtFalseOrderByIncomeDateDesc(UUID accountId);
    List<IncomeEntry> findTop5ByAccountIdAndDebtTrueOrderByIncomeDateDesc(UUID accountId);
    List<IncomeEntry> findAllByAccountIdOrderByIncomeDateDesc(UUID accountId);

    @Query("SELECT i FROM IncomeEntry i WHERE i.userId = :userId AND i.periodYear = :year AND i.debt = false ORDER BY i.incomeDate DESC")
    List<IncomeEntry> findByUserAndYear(@Param("userId") UUID userId, @Param("year") int year);

    @Modifying
    @Query("UPDATE IncomeEntry i SET i.accountId = null WHERE i.accountId = :accountId")
    void clearAccountId(@Param("accountId") UUID accountId);
}
