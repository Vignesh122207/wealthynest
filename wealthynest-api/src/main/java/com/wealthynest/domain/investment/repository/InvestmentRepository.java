package com.wealthynest.domain.investment.repository;

import com.wealthynest.common.entity.LifecycleStatus;
import com.wealthynest.domain.investment.entity.Investment;
import com.wealthynest.domain.investment.entity.InvestmentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InvestmentRepository extends JpaRepository<Investment, UUID> {
    List<Investment> findByUserIdAndStatus(UUID userId, LifecycleStatus status);
    List<Investment> findByUserId(UUID userId);
    boolean existsByDebitAccountId(UUID accountId);
    boolean existsByLinkedAccountId(UUID accountId);

    @Query("SELECT COALESCE(SUM(i.currentValue),0) FROM Investment i WHERE i.userId = :userId AND i.status = 'ACTIVE'")
    BigDecimal sumCurrentValueByUser(UUID userId);

    /** Same as sumCurrentValueByUser but for a whole set of users in one query — used by family
     * net worth so it isn't run once per member. */
    @Query("SELECT COALESCE(SUM(i.currentValue),0) FROM Investment i WHERE i.userId IN :userIds AND i.status = 'ACTIVE'")
    BigDecimal sumCurrentValueByUserIn(@Param("userIds") List<UUID> userIds);

    @Query("SELECT COALESCE(SUM(i.investedAmount),0) FROM Investment i WHERE i.userId = :userId AND i.status = 'ACTIVE'")
    BigDecimal sumInvestedAmountByUser(UUID userId);

    // Typed load queries — replaces findAll() + Java filter in all scheduler jobs
    List<Investment> findByInvestmentTypeAndStatus(InvestmentType type, LifecycleStatus status);

    Optional<Investment> findByUserIdAndSymbolAndInvestmentTypeAndStatus(
        UUID userId, String symbol, InvestmentType type, LifecycleStatus status);

    @Query("SELECT DISTINCT i.schemeCode FROM Investment i " +
           "WHERE i.status = 'ACTIVE' AND i.investmentType = 'MUTUAL_FUND' AND i.schemeCode IS NOT NULL")
    List<String> findDistinctActiveSchemeCodesForMF();

    /**
     * Bulk-update current_price and current_value for a single symbol using a known price.
     * Used by Yahoo Finance refresh — O(1) DB round-trip regardless of how many users hold this symbol.
     */
    @Modifying
    @Query(value = """
        UPDATE investments
           SET current_price = :price,
               current_value = units * :price
         WHERE symbol        = :symbol
           AND status         = 'ACTIVE'
           AND investment_type = 'STOCK'
           AND units          IS NOT NULL
        """, nativeQuery = true)
    int bulkUpdatePriceBySymbol(@Param("symbol") String symbol, @Param("price") BigDecimal price);

    /**
     * Single SQL statement to sync current_price and current_value for ALL active stock
     * investments from stock_price_cache after a bhavcopy load.
     * O(held symbols), not O(users × symbols).
     */
    @Modifying
    @Query(value = """
        UPDATE investments i
           SET current_price = spc.current_price,
               current_value = i.units * spc.current_price
          FROM stock_price_cache spc
         WHERE i.symbol          = spc.symbol
           AND i.status           = 'ACTIVE'
           AND i.investment_type  = 'STOCK'
           AND i.units            IS NOT NULL
        """, nativeQuery = true)
    int syncStockCurrentValuesFromCache();

    /**
     * Bulk-update NAV for all active MF investments with a given scheme code.
     * O(1) round-trip per scheme regardless of how many users hold it.
     */
    @Modifying
    @Query(value = """
        UPDATE investments
           SET current_price = :nav,
               current_value = units * :nav
         WHERE scheme_code      = :schemeCode
           AND status            = 'ACTIVE'
           AND investment_type   = 'MUTUAL_FUND'
           AND units             IS NOT NULL
        """, nativeQuery = true)
    int bulkUpdateNavBySchemeCode(@Param("schemeCode") String schemeCode, @Param("nav") BigDecimal nav);

    /**
     * Bulk-update gold price and current_value for all active GOLD/GOLD_ETF investments.
     * Single SQL handles all three karat tiers (18K, 22K, 24K) in one statement.
     */
    @Modifying
    @Query(value = """
        UPDATE investments
           SET current_price = CASE WHEN gold_karat = 24 THEN :p24
                                    WHEN gold_karat = 18 THEN :p18
                                                         ELSE :p22 END,
               current_value = quantity_grams
                               * CASE WHEN gold_karat = 24 THEN :p24
                                      WHEN gold_karat = 18 THEN :p18
                                                           ELSE :p22 END
         WHERE status           = 'ACTIVE'
           AND investment_type  IN ('GOLD', 'GOLD_ETF')
           AND quantity_grams   IS NOT NULL
        """, nativeQuery = true)
    int bulkUpdateGoldPrice(@Param("p22") BigDecimal p22, @Param("p18") BigDecimal p18, @Param("p24") BigDecimal p24);
}
