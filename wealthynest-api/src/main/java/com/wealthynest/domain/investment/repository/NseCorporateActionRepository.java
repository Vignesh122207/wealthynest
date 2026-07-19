package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.NseCorporateAction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface NseCorporateActionRepository extends JpaRepository<NseCorporateAction, UUID> {
    List<NseCorporateAction> findBySymbolAndExDateAfterOrderByExDateDesc(String symbol, LocalDate after);
    boolean existsBySymbolAndActionTypeAndExDate(String symbol, String actionType, LocalDate exDate);

    /** exDate stays a plain range predicate (not YEAR(ca.exDate) = :year) so it can use the
     * symbol/exDate index instead of forcing a per-row function evaluation. */
    default List<NseCorporateAction> findDividendsBySymbolsAndYear(Collection<String> symbols, int year) {
        LocalDate start = LocalDate.of(year, 1, 1);
        return findDividendsBySymbolsAndDateRange(symbols, start, start.plusYears(1));
    }

    @Query("SELECT ca FROM NseCorporateAction ca WHERE ca.symbol IN :symbols AND ca.actionType = 'DIVIDEND' " +
           "AND ca.exDate >= :start AND ca.exDate < :end ORDER BY ca.exDate DESC")
    List<NseCorporateAction> findDividendsBySymbolsAndDateRange(
            @Param("symbols") Collection<String> symbols, @Param("start") LocalDate start, @Param("end") LocalDate end);
}
