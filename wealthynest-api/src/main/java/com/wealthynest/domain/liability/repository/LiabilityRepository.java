package com.wealthynest.domain.liability.repository;

import com.wealthynest.domain.liability.entity.Liability;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface LiabilityRepository extends JpaRepository<Liability, UUID> {

    List<Liability> findByUserIdAndActiveTrueOrderByCreatedAtDesc(UUID userId);

    @Query("SELECT COALESCE(SUM(l.outstandingAmount),0) FROM Liability l WHERE l.userId = :userId AND l.active = true")
    BigDecimal sumOutstandingByUser(UUID userId);

    /** Same as sumOutstandingByUser but for a whole set of users in one query — used by family
     * net worth so it isn't run once per member. */
    @Query("SELECT COALESCE(SUM(l.outstandingAmount),0) FROM Liability l WHERE l.userId IN :userIds AND l.active = true")
    BigDecimal sumOutstandingByUserIn(@Param("userIds") List<UUID> userIds);

    @Modifying
    @Query("UPDATE Liability l SET l.familyId = :familyId WHERE l.userId = :userId AND l.familyId IS NULL")
    void migrateUserLiabilitiesToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Liability l SET l.familyId = null WHERE l.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);

    /** Detaches one departing member's own liabilities from the family. */
    @Modifying
    @Query("UPDATE Liability l SET l.familyId = null WHERE l.userId = :userId AND l.familyId = :familyId")
    void clearFamilyIdForUser(@Param("userId") UUID userId, @Param("familyId") UUID familyId);
}
