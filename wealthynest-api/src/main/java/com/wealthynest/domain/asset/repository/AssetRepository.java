package com.wealthynest.domain.asset.repository;

import com.wealthynest.domain.asset.entity.Asset;
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
public interface AssetRepository extends JpaRepository<Asset, UUID> {
    List<Asset> findByUserIdAndActiveTrue(UUID userId);
    Optional<Asset> findByIdAndUserId(UUID id, UUID userId);

    /** Used for permanent account erasure — cascades to investments (asset_id ON DELETE CASCADE)
     * at the DB level, so investment_income_log must already be cleared for this user before this runs. */
    void deleteByUserId(UUID userId);

    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.userId = :userId AND a.active = true")
    BigDecimal sumCurrentValueByUser(UUID userId);

    /** Sums only manual (non-investment-linked) assets to avoid double-counting with investment portfolio. */
    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.userId = :userId AND a.active = true " +
           "AND a.id NOT IN (SELECT i.assetId FROM Investment i WHERE i.userId = :userId AND i.active = true AND i.assetId IS NOT NULL)")
    BigDecimal sumManualAssetValueByUser(@Param("userId") UUID userId);

    /** Same as sumManualAssetValueByUser but for a whole set of users in one query — used by
     * family net worth so it isn't run once per member. */
    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.userId IN :userIds AND a.active = true " +
           "AND a.id NOT IN (SELECT i.assetId FROM Investment i WHERE i.userId IN :userIds AND i.active = true AND i.assetId IS NOT NULL)")
    BigDecimal sumManualAssetValueByUserIn(@Param("userIds") List<UUID> userIds);

    @Query("SELECT COALESCE(SUM(a.currentValue),0) FROM Asset a WHERE a.familyId = :familyId AND a.active = true")
    BigDecimal sumCurrentValueByFamily(UUID familyId);

    @Modifying
    @Query("UPDATE Asset a SET a.familyId = :familyId WHERE a.userId = :userId AND a.familyId IS NULL")
    void migrateUserAssetsToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Asset a SET a.familyId = null WHERE a.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);

    /** Detaches one departing member's own assets from the family. */
    @Modifying
    @Query("UPDATE Asset a SET a.familyId = null WHERE a.userId = :userId AND a.familyId = :familyId")
    void clearFamilyIdForUser(@Param("userId") UUID userId, @Param("familyId") UUID familyId);
}
