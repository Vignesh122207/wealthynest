package com.wealthynest.domain.asset.repository;

import com.wealthynest.domain.asset.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface AssetRepository extends JpaRepository<Asset, UUID> {
    List<Asset> findByUserIdAndActiveTrue(UUID userId);
    List<Asset> findByFamilyIdAndActiveTrue(UUID familyId);

    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.userId = :userId AND a.active = true")
    BigDecimal sumCurrentValueByUser(UUID userId);

    /** Sums only manual (non-investment-linked) assets to avoid double-counting with investment portfolio. */
    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.userId = :userId AND a.active = true " +
           "AND a.id NOT IN (SELECT i.assetId FROM Investment i WHERE i.userId = :userId AND i.active = true AND i.assetId IS NOT NULL)")
    BigDecimal sumManualAssetValueByUser(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.familyId = :familyId AND a.active = true")
    BigDecimal sumCurrentValueByFamily(UUID familyId);

    @Modifying
    @Query("UPDATE Asset a SET a.familyId = :familyId WHERE a.userId = :userId AND a.familyId IS NULL")
    void migrateUserAssetsToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Asset a SET a.familyId = null WHERE a.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);
}
