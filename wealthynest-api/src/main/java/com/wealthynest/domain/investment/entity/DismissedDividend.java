package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "dismissed_dividends")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DismissedDividend {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id",       nullable = false) private UUID userId;
    @Column(name = "investment_id", nullable = false) private UUID investmentId;
    @Column(name = "ex_date",       nullable = false) private LocalDate exDate;
    @Column(name = "dismissed_at")  @Builder.Default  private Instant dismissedAt = Instant.now();
}
