package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.StockMaster;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface StockMasterRepository extends JpaRepository<StockMaster, Long> {

    /**
     * Case-insensitive search on symbol and company name.
     * All NSE results are included; BSE results only appear when the same symbol
     * is not already listed on NSE (avoids showing duplicates for dual-listed stocks).
     * Results ranked: exact symbol > symbol starts-with > company starts-with > contains.
     */
    @Query("""
        SELECT s FROM StockMaster s
        WHERE s.active = true
          AND (LOWER(s.symbol)      LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(s.companyName) LIKE LOWER(CONCAT('%', :q, '%')))
          AND (s.exchange = 'NSE'
            OR NOT EXISTS (
              SELECT 1 FROM StockMaster n
              WHERE n.exchange = 'NSE' AND n.active = true
                AND (LOWER(n.symbol) = LOWER(s.symbol)
                  OR (n.isin IS NOT NULL AND s.isin IS NOT NULL AND n.isin = s.isin))
            ))
        ORDER BY
          CASE WHEN LOWER(s.symbol)      = LOWER(:q) THEN 0
               WHEN LOWER(s.symbol)      LIKE LOWER(CONCAT(:q, '%')) THEN 1
               WHEN LOWER(s.companyName) LIKE LOWER(CONCAT(:q, '%')) THEN 2
               ELSE 3 END,
          CASE WHEN s.exchange = 'NSE' THEN 0 ELSE 1 END,
          LENGTH(s.symbol),
          s.symbol
        """)
    List<StockMaster> search(@Param("q") String q, Pageable pageable);

    Optional<StockMaster> findBySymbolAndExchange(String symbol, String exchange);

    long countByExchange(String exchange);

    /**
     * Returns (symbol, isin) pairs for stock_master entries whose ISIN appears in the
     * bhavcopy but whose own symbol is NOT in the bhavcopy.
     * Used to create alias cache entries so FINOLEXCAB-style user symbols auto-resolve
     * to the price fetched under the bhavcopy ticker (e.g. FINCABLES).
     */
    @Query("SELECT sm.symbol, sm.isin FROM StockMaster sm " +
           "WHERE sm.isin IN :isins AND sm.symbol NOT IN :bhavSymbols " +
           "AND sm.isin IS NOT NULL AND sm.active = true")
    List<Object[]> findAltSymbolsByIsin(@Param("isins") Collection<String> isins,
                                        @Param("bhavSymbols") Collection<String> bhavSymbols);
}
