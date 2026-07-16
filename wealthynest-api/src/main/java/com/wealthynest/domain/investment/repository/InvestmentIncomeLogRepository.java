package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.InvestmentIncomeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface InvestmentIncomeLogRepository extends JpaRepository<InvestmentIncomeLog, UUID> {

    boolean existsByInvestmentIdAndIncomeTypeAndEventDate(
            UUID investmentId, String incomeType, LocalDate eventDate);

    @Query("SELECT l FROM InvestmentIncomeLog l WHERE l.userId = :userId " +
           "AND YEAR(l.eventDate) = :year ORDER BY l.eventDate DESC")
    List<InvestmentIncomeLog> findByUserIdAndYear(@Param("userId") UUID userId, @Param("year") int year);

    @Query("SELECT COALESCE(SUM(l.amount), 0) FROM InvestmentIncomeLog l " +
           "WHERE l.userId = :userId AND l.incomeType = :incomeType")
    java.math.BigDecimal sumByUserAndIncomeType(@Param("userId") UUID userId,
                                                @Param("incomeType") String incomeType);

    List<InvestmentIncomeLog> findByInvestmentId(UUID investmentId);

    /** income_entry_id has no ON DELETE policy — must be cleared before the income row it points to is deleted. */
    @Modifying
    @Query("UPDATE InvestmentIncomeLog l SET l.incomeEntryId = null WHERE l.incomeEntryId = :incomeEntryId")
    void clearIncomeEntryId(@Param("incomeEntryId") UUID incomeEntryId);
}
