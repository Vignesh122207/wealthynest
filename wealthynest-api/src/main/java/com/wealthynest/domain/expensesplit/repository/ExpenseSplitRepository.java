package com.wealthynest.domain.expensesplit.repository;

import com.wealthynest.domain.expensesplit.entity.ExpenseSplit;
import com.wealthynest.domain.expensesplit.entity.SplitStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseSplitRepository extends JpaRepository<ExpenseSplit, UUID> {

    List<ExpenseSplit> findByParticipantUserIdAndStatus(UUID participantUserId, SplitStatus status);
    List<ExpenseSplit> findByPayerUserIdAndStatus(UUID payerUserId, SplitStatus status);
    List<ExpenseSplit> findByExpenseId(UUID expenseId);

    @Query("SELECT COALESCE(SUM(s.shareAmount), 0) FROM ExpenseSplit s WHERE s.expenseId = :expenseId")
    BigDecimal sumSharesByExpenseId(@Param("expenseId") UUID expenseId);

    /** Bulk-settles every pending split between two family members, in either direction — powers
     * the "Settle up" action on a net balance instead of requiring one confirmation per expense. */
    @Modifying
    @Query("""
        UPDATE ExpenseSplit s SET s.status = 'SETTLED', s.settledAt = :now
        WHERE s.status = 'PENDING'
        AND ((s.participantUserId = :userId AND s.payerUserId = :counterpartId)
          OR (s.payerUserId = :userId AND s.participantUserId = :counterpartId))
        """)
    int settleBetween(@Param("userId") UUID userId, @Param("counterpartId") UUID counterpartId, @Param("now") Instant now);
}
