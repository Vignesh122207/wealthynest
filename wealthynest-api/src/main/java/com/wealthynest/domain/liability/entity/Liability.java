package com.wealthynest.domain.liability.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "liabilities")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Liability extends BaseEntity {

    @Column(name = "user_id",   nullable = false) private UUID userId;
    @Column(name = "family_id")                   private UUID familyId;

    @Column(nullable = false, length = 100)        private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "liability_type", nullable = false, length = 30) private LiabilityType liabilityType;

    @Column(name = "principal_amount",   nullable = false, precision = 16, scale = 2)
    @Builder.Default private BigDecimal principalAmount   = BigDecimal.ZERO;

    @Column(name = "outstanding_amount", nullable = false, precision = 16, scale = 2)
    @Builder.Default private BigDecimal outstandingAmount = BigDecimal.ZERO;

    @Column(name = "interest_rate", precision = 5, scale = 2) private BigDecimal interestRate;

    @Column(name = "lender_name", length = 100) private String lenderName;

    @Column(name = "emi_amount", precision = 14, scale = 2) private BigDecimal emiAmount;

    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "end_date")   private LocalDate endDate;

    @Column(columnDefinition = "TEXT") private String notes;

    @Column(name = "is_active", nullable = false) @Builder.Default private boolean active = true;
}
