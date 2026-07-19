package com.wealthynest.domain.recurringgoalcontribution.repository;

import com.wealthynest.domain.recurringgoalcontribution.entity.RecurringGoalContribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecurringGoalContributionRepository extends JpaRepository<RecurringGoalContribution, UUID> {
    List<RecurringGoalContribution> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<RecurringGoalContribution> findByActiveTrue();
    Optional<RecurringGoalContribution> findByIdAndUserId(UUID id, UUID userId);
}
