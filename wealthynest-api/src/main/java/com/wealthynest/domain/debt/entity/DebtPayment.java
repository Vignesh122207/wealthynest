package com.wealthynest.domain.debt.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "debt_payments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DebtPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "debt_id", nullable = false)
    private UUID debtId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(length = 255)
    private String note;

    @Column(name = "paid_at", nullable = false)
    @Builder.Default
    private Instant paidAt = Instant.now();

    @Column(name = "linked_entry_id")
    private UUID linkedEntryId;
}
