package com.wealthynest.domain.account.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class AccountResponse {
    private UUID       id;
    private String     accountType;
    private String     name;
    private String     bankName;
    private String     accountNumber;
    private BigDecimal openingBalance;
    private BigDecimal currentBalance;
    private BigDecimal lowBalanceThreshold;
    private boolean     belowLowBalanceThreshold;
    private BigDecimal totalMoneyIn;
    private BigDecimal totalMoneyOut;
    private List<AccountTransactionItem> recentTransactions;
    private Instant    createdAt;
    private String     status;
    private String     purpose;
    private String     purposeLabel;
    private boolean    primary;
    private boolean    excludeFromNetWorth;

    // Credit card fields (null for non-credit-card accounts)
    private BigDecimal creditLimit;
    private BigDecimal availableCredit;
    private Integer    statementDay;
    private Integer    paymentDueDay;
    private BigDecimal apr;
    private LocalDate  nextStatementDate;
    private LocalDate  nextDueDate;

    // Loan fields (null for non-loan accounts; currentBalance = outstanding, apr = interest rate)
    private String     loanType;
    private BigDecimal principalAmount;
    private BigDecimal emiAmount;
    private Integer    emiDay;
    private UUID       autopayAccountId;
    private String     autopayAccountName;
    private LocalDate  loanEndDate;
    private LocalDate  nextEmiDate;
}
