package com.wealthynest.domain.account.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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

    /** Optional — fires a (deduped, once/day) low-balance notification when the live balance
     * drops at/below this. Null = alert disabled. Meaningless for liability accounts. */
    @Column(name = "low_balance_threshold", precision = 14, scale = 2)
    private BigDecimal lowBalanceThreshold;

    // Credit card fields (null for non-credit-card accounts)
    @Column(name = "credit_limit", precision = 15, scale = 2)
    private BigDecimal creditLimit;

    @Column(name = "statement_day")
    private Integer statementDay;

    @Column(name = "payment_due_day")
    private Integer paymentDueDay;

    @Column(name = "apr", precision = 5, scale = 2)
    private BigDecimal apr;

    // Loan fields (null for non-loan accounts; apr doubles as the loan interest rate,
    // bank_name as the lender / broker name, opening_balance as the outstanding at creation)
    @Enumerated(EnumType.STRING)
    @Column(name = "loan_type", length = 20)
    private LoanType loanType;

    @Column(name = "principal_amount", precision = 16, scale = 2)
    private BigDecimal principalAmount;

    @Column(name = "emi_amount", precision = 14, scale = 2)
    private BigDecimal emiAmount;

    @Column(name = "emi_day")
    private Integer emiDay;

    /** Bank account EMIs are auto-debited from; null = manual payments only. */
    @Column(name = "autopay_account_id")
    private UUID autopayAccountId;

    @Column(name = "loan_end_date")
    private LocalDate loanEndDate;

    /** yyyymm of the last autopay run — prevents double-paying within a month. */
    @Column(name = "last_emi_yyyymm")
    private Integer lastEmiYyyymm;

    @Column(nullable = false)
    @Builder.Default
    private boolean archived = false;

    /** Only meaningful for BANK_ACCOUNT; at most one primary account per user. */
    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean primary = false;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
