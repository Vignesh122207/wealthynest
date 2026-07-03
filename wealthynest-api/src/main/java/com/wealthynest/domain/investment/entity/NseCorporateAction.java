package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "nse_corporate_actions")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class NseCorporateAction {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(length = 30, nullable = false) private String symbol;
    @Column(name = "action_type", length = 20) @Builder.Default private String actionType = "DIVIDEND";
    @Column(name = "ex_date",     nullable = false) private LocalDate exDate;
    @Column(name = "record_date") private LocalDate recordDate;
    @Column(name = "dividend_per_share", precision = 10, scale = 4) private BigDecimal dividendPerShare;
    @Column(name = "created_at") private Instant createdAt;

    @PrePersist void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}
