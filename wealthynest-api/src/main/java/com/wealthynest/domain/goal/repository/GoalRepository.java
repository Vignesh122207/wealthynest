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

    @Modifying
    @Query("UPDATE Goal g SET g.accountId = null WHERE g.accountId = :accountId")
    void clearAccountId(@Param("accountId") UUID accountId);
}
