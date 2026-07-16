package com.wealthynest.domain.debt.repository;

import com.wealthynest.domain.debt.entity.DebtRecord;
import com.wealthynest.domain.debt.entity.DebtStatus;
import com.wealthynest.domain.debt.entity.DebtType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DebtRecordRepository extends JpaRepository<DebtRecord, UUID> {
    List<DebtRecord>     findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<DebtRecord>     findByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, DebtType type);
    Optional<DebtRecord> findByIdAndUserId(UUID id, UUID userId);
    List<DebtRecord>     findByStatusAndDueDateIsNotNull(DebtStatus status);
}
