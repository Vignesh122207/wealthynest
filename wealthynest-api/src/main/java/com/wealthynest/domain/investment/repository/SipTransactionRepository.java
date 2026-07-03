package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.SipTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface SipTransactionRepository extends JpaRepository<SipTransaction, Long> {

    List<SipTransaction> findByInvestmentIdOrderByTransactionDateAsc(UUID investmentId);

    @Query("SELECT COALESCE(SUM(s.amount), 0) FROM SipTransaction s WHERE s.investmentId = :id AND s.transactionType = 'BUY'")
    BigDecimal sumBuyAmountByInvestmentId(@Param("id") UUID id);

    @Query("SELECT COALESCE(SUM(s.units), 0) FROM SipTransaction s WHERE s.investmentId = :id AND s.transactionType = 'BUY'")
    BigDecimal sumUnitsByInvestmentId(@Param("id") UUID id);

    boolean existsByInvestmentId(UUID investmentId);
}
