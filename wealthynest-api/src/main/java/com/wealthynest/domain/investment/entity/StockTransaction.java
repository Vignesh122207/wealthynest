package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "stock_transactions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class StockTransaction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investment_id", nullable = false) private UUID investmentId;
    @Column(name = "transaction_date", nullable = false) private LocalDate transactionDate;
    @Column(name = "transaction_type", nullable = false, length = 10) @Builder.Default private String transactionType = "BUY";
    @Column(nullable = false, precision = 14, scale = 4) private BigDecimal quantity;
    @Column(name = "price_per_share", nullable = false, precision = 14, scale = 4) private BigDecimal pricePerShare;
    @Column(precision = 14, scale = 2) @Builder.Default private BigDecimal brokerage = BigDecimal.ZERO;
    @Column(length = 500) private String notes;
    @Column(name = "created_at") @Builder.Default private Instant createdAt = Instant.now();
}
