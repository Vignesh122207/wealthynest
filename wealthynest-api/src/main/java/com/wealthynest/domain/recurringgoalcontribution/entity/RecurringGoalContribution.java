package com.wealthynest.domain.recurringgoalcontribution.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "recurring_goal_contribution")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecurringGoalContribution {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "goal_id", nullable = false)
    private UUID goalId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    /** 1–31 = fixed day of month; 0 = last working day */
    @Column(name = "day_of_month", nullable = false)
    private int dayOfMonth;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "last_contributed_month")
    private Integer lastContributedMonth;

    @Column(name = "last_contributed_at")
    private LocalDateTime lastContributedAt;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
