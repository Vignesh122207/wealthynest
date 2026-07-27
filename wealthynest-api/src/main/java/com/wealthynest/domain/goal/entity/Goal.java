package com.wealthynest.domain.goal.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "goals")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Goal extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "family_id")
    private UUID familyId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 10)
    private String icon;

    @Column(length = 7)
    private String color;

    @Column(name = "target_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "saved_amount", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal savedAmount = BigDecimal.ZERO;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "account_id")
    private UUID accountId;

    @Column(nullable = false)
    @Builder.Default
    private boolean paused = false;
}
