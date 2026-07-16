package com.wealthynest.domain.recurringtransfer.repository;

import com.wealthynest.domain.recurringtransfer.entity.RecurringTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RecurringTransferRepository extends JpaRepository<RecurringTransfer, UUID> {
    List<RecurringTransfer> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<RecurringTransfer> findByActiveTrue();
    Optional<RecurringTransfer> findByIdAndUserId(UUID id, UUID userId);
}
