package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "investment_income_log")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class InvestmentIncomeLog {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "investment_id",  nullable = false) private UUID investmentId;
    @Column(name = "user_id",        nullable = false) private UUID userId;
    @Column(name = "income_entry_id") private UUID incomeEntryId;
    @Column(name = "income_type", length = 20, nullable = false) private String incomeType;
    @Column(name = "event_date",  nullable = false) private LocalDate eventDate;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    @Column(name = "created_at") private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
