package com.wealthynest.domain.goal.repository;

import com.wealthynest.domain.goal.entity.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface GoalRepository extends JpaRepository<Goal, UUID> {
    List<Goal> findByUserIdOrderByCreatedAtAsc(UUID userId);

    // Family-scoped equivalent, for a caller currently in a family — mirrors BudgetRepository.
    List<Goal> findByFamilyIdOrderByCreatedAtAsc(UUID familyId);

    @Modifying
    @Query("UPDATE Goal g SET g.accountId = null WHERE g.accountId = :accountId")
    void clearAccountId(@Param("accountId") UUID accountId);

    @Modifying
    @Query("UPDATE Goal g SET g.familyId = :familyId WHERE g.userId = :userId AND g.familyId IS NULL")
    void migrateUserGoalsToFamily(@Param("familyId") UUID familyId, @Param("userId") UUID userId);

    @Modifying
    @Query("UPDATE Goal g SET g.familyId = null WHERE g.familyId = :familyId")
    void clearFamilyId(@Param("familyId") UUID familyId);

    /** Detaches one departing member's own goals from the family. */
    @Modifying
    @Query("UPDATE Goal g SET g.familyId = null WHERE g.userId = :userId AND g.familyId = :familyId")
    void clearFamilyIdForUser(@Param("userId") UUID userId, @Param("familyId") UUID familyId);
}
