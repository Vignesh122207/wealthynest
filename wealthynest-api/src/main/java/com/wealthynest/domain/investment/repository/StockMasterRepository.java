package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.StockMaster;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StockMasterRepository extends JpaRepository<StockMaster, Long> {

    /**
     * Case-insensitive search on symbol and company name.
     * Results ranked: exact symbol > symbol starts-with > company starts-with > contains.
     * Shorter symbols rank before longer ones at the same tier (canonical NSE symbols are shorter).
     */
    @Query("""
        SELECT s FROM StockMaster s
        WHERE s.active = true
          AND (LOWER(s.symbol)      LIKE LOWER(CONCAT('%', :q, '%'))
            OR LOWER(s.companyName) LIKE LOWER(CONCAT('%', :q, '%')))
        ORDER BY
          CASE WHEN LOWER(s.symbol)      = LOWER(:q) THEN 0
               WHEN LOWER(s.symbol)      LIKE LOWER(CONCAT(:q, '%')) THEN 1
               WHEN LOWER(s.companyName) LIKE LOWER(CONCAT(:q, '%')) THEN 2
               ELSE 3 END,
          LENGTH(s.symbol),
          s.exchange, s.symbol
        """)
    List<StockMaster> search(@Param("q") String q, Pageable pageable);

    Optional<StockMaster> findBySymbolAndExchange(String symbol, String exchange);

    long countByExchange(String exchange);
}
