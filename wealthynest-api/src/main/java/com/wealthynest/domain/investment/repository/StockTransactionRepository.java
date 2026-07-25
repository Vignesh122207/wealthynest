package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.StockTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface StockTransactionRepository extends JpaRepository<StockTransaction, Long> {
    List<StockTransaction> findByInvestmentIdOrderByTransactionDateAsc(UUID investmentId);

    /** Batch-load variant for portfolio-wide aggregation (e.g. computePortfolioXirr) — avoids
     * one query per investment. */
    List<StockTransaction> findByInvestmentIdInOrderByTransactionDateAsc(Collection<UUID> investmentIds);

    @Query("SELECT COALESCE(SUM(CASE WHEN t.transactionType = 'BUY' THEN t.quantity ELSE -t.quantity END), 0) FROM StockTransaction t WHERE t.investmentId = :investmentId")
    java.math.BigDecimal sumNetQuantityByInvestmentId(UUID investmentId);

    @Query("SELECT COALESCE(SUM(CASE WHEN t.transactionType = 'BUY' THEN t.quantity * t.pricePerShare ELSE 0 END), 0) FROM StockTransaction t WHERE t.investmentId = :investmentId")
    java.math.BigDecimal sumBuyAmountByInvestmentId(UUID investmentId);

    @Query("SELECT COALESCE(SUM(CASE WHEN t.transactionType = 'BUY' THEN t.quantity ELSE 0 END), 0) FROM StockTransaction t WHERE t.investmentId = :investmentId")
    java.math.BigDecimal sumBuyQuantityByInvestmentId(UUID investmentId);

    long countByInvestmentId(UUID investmentId);

    /** Batch-load variant for a portfolio list response (InvestmentServiceImpl#enrichAll) — one
     * grouped query for every stock investment's transaction count, instead of one
     * countByInvestmentId per row. */
    @Query("SELECT t.investmentId, COUNT(t) FROM StockTransaction t WHERE t.investmentId IN :investmentIds GROUP BY t.investmentId")
    List<Object[]> countByInvestmentIdIn(Collection<UUID> investmentIds);
}
