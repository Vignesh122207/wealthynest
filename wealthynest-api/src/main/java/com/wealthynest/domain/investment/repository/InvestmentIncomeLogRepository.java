package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.InvestmentIncomeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface InvestmentIncomeLogRepository extends JpaRepository<InvestmentIncomeLog, UUID> {

    boolean existsByInvestmentIdAndIncomeTypeAndEventDate(
            UUID investmentId, String incomeType, LocalDate eventDate);

    /** Batched equivalent of existsByInvestmentIdAndIncomeTypeAndEventDate for a whole portfolio at
     * once — see InvestmentServiceImpl#getDividendSuggestions, which used to call the single-row
     * exists() once per (investment, corporate action) pair, an N×M query fan-out on every
     * dashboard load. */
    List<InvestmentIncomeLog> findByInvestmentIdInAndIncomeType(Collection<UUID> investmentIds, String incomeType);

    default List<InvestmentIncomeLog> findByUserIdAndYear(UUID userId, int year) {
        LocalDate start = LocalDate.of(year, 1, 1);
        return findByUserIdAndDateRange(userId, start, start.plusYears(1));
    }

    @Query("SELECT l FROM InvestmentIncomeLog l WHERE l.userId = :userId " +
           "AND l.eventDate >= :start AND l.eventDate < :end ORDER BY l.eventDate DESC")
    List<InvestmentIncomeLog> findByUserIdAndDateRange(@Param("userId") UUID userId,
                                                        @Param("start") LocalDate start, @Param("end") LocalDate end);

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
