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

    @Query("SELECT ca FROM NseCorporateAction ca WHERE ca.symbol IN :symbols AND ca.actionType = 'DIVIDEND' " +
           "AND YEAR(ca.exDate) = :year ORDER BY ca.exDate DESC")
    List<NseCorporateAction> findDividendsBySymbolsAndYear(
            @Param("symbols") Collection<String> symbols, @Param("year") int year);
}
