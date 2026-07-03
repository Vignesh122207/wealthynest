package com.wealthynest.domain.dividend.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "dividend_income")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DividendIncome extends BaseEntity {
    @Column(name = "investment_id", nullable = false) private UUID investmentId;
    @Column(name = "user_id",       nullable = false) private UUID userId;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    @Column(name = "dividend_date", nullable = false) private LocalDate dividendDate;
    @Column(name = "tax_deducted",  precision = 14, scale = 2) @Builder.Default private BigDecimal taxDeducted = BigDecimal.ZERO;
    @Column(columnDefinition = "TEXT") private String notes;
}
