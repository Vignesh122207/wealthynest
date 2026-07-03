package com.wealthynest.domain.account.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "wallet_accounts")
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WalletAccount {

    @Id @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 20)
    private AccountType accountType;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "account_number", length = 20)
    private String accountNumber;

    @Column(name = "opening_balance", nullable = false, precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal openingBalance = BigDecimal.ZERO;

    // Credit card fields (null for non-credit-card accounts)
    @Column(name = "credit_limit", precision = 15, scale = 2)
    private BigDecimal creditLimit;

    @Column(name = "statement_day")
    private Integer statementDay;

    @Column(name = "payment_due_day")
    private Integer paymentDueDay;

    @Column(name = "apr", precision = 5, scale = 2)
    private BigDecimal apr;

    @Column(nullable = false)
    @Builder.Default
    private boolean archived = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
