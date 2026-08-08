package com.wealthynest.domain.account.entity;

import com.wealthynest.common.entity.AccountPurpose;
import com.wealthynest.common.entity.BaseEntity;
import com.wealthynest.common.entity.LifecycleStatus;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "wallet_accounts")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WalletAccount extends BaseEntity {

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

    /** Optional "what is this money for" tag — only ever set when accountType == BANK_ACCOUNT. */
    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private AccountPurpose purpose;

    /** Free-text label, set only when purpose == CUSTOM — becomes its own Dashboard bucket. */
    @Column(name = "purpose_label", length = 100)
    private String purposeLabel;

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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private LifecycleStatus status = LifecycleStatus.ACTIVE;

    /** Only meaningful for BANK_ACCOUNT; at most one primary account per user. */
    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private boolean primary = false;

    /** Opt-out of net worth totals for an account still tracked in-app (a joint account, a
     * company-reimbursed card) but that shouldn't count toward the user's own net worth. Purely
     * a display/rollup flag — never affects the account's own balance math. */
    @Column(name = "exclude_from_net_worth", nullable = false)
    @Builder.Default
    private boolean excludeFromNetWorth = false;
}
