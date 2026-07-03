package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "sip_transactions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SipTransaction {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investment_id", nullable = false)
    private UUID investmentId;

    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(precision = 18, scale = 4)
    private BigDecimal units;

    @Column(precision = 18, scale = 4)
    private BigDecimal nav;

    @Column(name = "transaction_type", length = 20)
    @Builder.Default
    private String transactionType = "BUY";

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @PrePersist void onCreate() { createdAt = Instant.now(); }
}
