package com.wealthynest.domain.expensesplit.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One participant's owed share of a family expense (Splitwise-style) — an IOU from
 * participantUserId to payerUserId, scoped to a single expense. The payer's own share isn't
 * represented here; only rows for the other participants exist.
 */
@Entity
@Table(name = "expense_splits")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ExpenseSplit {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "expense_id", nullable = false)
    private UUID expenseId;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "payer_user_id", nullable = false)
    private UUID payerUserId;

    @Column(name = "participant_user_id", nullable = false)
    private UUID participantUserId;

    @Column(name = "share_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal shareAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private SplitStatus status = SplitStatus.PENDING;

    @Column(name = "settled_at")
    private Instant settledAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
