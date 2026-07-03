package com.wealthynest.domain.debt.repository;

import com.wealthynest.domain.debt.entity.DebtRecord;
import com.wealthynest.domain.debt.entity.DebtType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DebtRecordRepository extends JpaRepository<DebtRecord, UUID> {
    List<DebtRecord>     findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<DebtRecord>     findByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, DebtType type);
    Optional<DebtRecord> findByIdAndUserId(UUID id, UUID userId);

    List<DebtRecord> findTop10ByAccountIdOrderByCreatedAtDesc(UUID accountId);

    /** Money you lent that is still outstanding — reduces account balance */
    @Query("SELECT COALESCE(SUM(d.amount - d.amountSettled), 0) FROM DebtRecord d " +
           "WHERE d.accountId = :accountId AND d.type = 'LENT' AND d.status <> 'SETTLED'")
    BigDecimal sumLentRemainingByAccountId(@Param("accountId") UUID accountId);

    /** Money you borrowed that is still outstanding — increases account balance */
    @Query("SELECT COALESCE(SUM(d.amount - d.amountSettled), 0) FROM DebtRecord d " +
           "WHERE d.accountId = :accountId AND d.type = 'BORROWED' AND d.status <> 'SETTLED'")
    BigDecimal sumBorrowedRemainingByAccountId(@Param("accountId") UUID accountId);
}
