package com.wealthynest.domain.investment.repository;

import com.wealthynest.domain.investment.entity.Investment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface InvestmentRepository extends JpaRepository<Investment, UUID> {
    List<Investment> findByUserIdAndActiveTrue(UUID userId);
    List<Investment> findByUserId(UUID userId);
    List<Investment> findByAssetId(UUID assetId);
    boolean existsByAssetIdAndActiveTrueAndIdNot(UUID assetId, UUID excludeId);

    @Query("SELECT COALESCE(SUM(i.currentValue),0) FROM Investment i WHERE i.userId = :userId AND i.active = true")
    BigDecimal sumCurrentValueByUser(UUID userId);

    @Query("SELECT COALESCE(SUM(i.investedAmount),0) FROM Investment i WHERE i.userId = :userId AND i.active = true")
    BigDecimal sumInvestedAmountByUser(UUID userId);

    @Modifying
    @Query("UPDATE Investment i SET i.linkedAccountId = null WHERE i.linkedAccountId = :accountId")
    void clearLinkedAccountId(@Param("accountId") UUID accountId);

    @Modifying
    @Query("UPDATE Investment i SET i.debitAccountId = null, i.debitTransferId = null WHERE i.debitAccountId = :accountId")
    void clearDebitAccountId(@Param("accountId") UUID accountId);
}
