package com.wealthynest.domain.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "stock_master",
    uniqueConstraints = @UniqueConstraint(name = "uq_stock_master", columnNames = {"symbol","exchange"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class StockMaster {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String symbol;

    @Column(name = "company_name", nullable = false, length = 300)
    private String companyName;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String exchange = "NSE";

    @Column(length = 20)
    private String isin;

    @Column(length = 10)
    private String series;

    @Column(length = 100)
    private String sector;

    @Column(name = "is_active")
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist  void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate   void onUpdate() { updatedAt = Instant.now(); }
}
