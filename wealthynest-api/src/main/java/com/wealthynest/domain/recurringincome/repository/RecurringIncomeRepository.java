package com.wealthynest.domain.recurringincome.repository;

import com.wealthynest.domain.recurringincome.entity.RecurringIncome;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecurringIncomeRepository extends JpaRepository<RecurringIncome, UUID> {
    List<RecurringIncome> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<RecurringIncome> findByActiveTrue();
    Optional<RecurringIncome> findByIdAndUserId(UUID id, UUID userId);
}
