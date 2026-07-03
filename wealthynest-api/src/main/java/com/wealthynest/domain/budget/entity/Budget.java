package com.wealthynest.domain.budget.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "budgets")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Budget extends BaseEntity {
    @Column(name = "family_id")  private UUID familyId;
    @Column(name = "user_id")    private UUID userId;
    @Column(name = "category_id", nullable = false) private UUID categoryId;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    @Column(name = "period_month", nullable = false) private int periodMonth;
    @Column(name = "period_year",  nullable = false) private int periodYear;
    @Column(name = "alert_threshold") @Builder.Default private BigDecimal alertThreshold = new BigDecimal("80.00");
    @Enumerated(EnumType.STRING)
    @Column(name = "budget_type", nullable = false, length = 10)
    @Builder.Default private BudgetType budgetType = BudgetType.MONTHLY;
}
