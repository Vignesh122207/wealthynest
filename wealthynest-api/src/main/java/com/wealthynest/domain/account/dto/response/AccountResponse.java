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
    private BigDecimal totalMoneyIn;
    private BigDecimal totalMoneyOut;
    private List<AccountTransactionItem> recentTransactions;
    private Instant    createdAt;
    private boolean    archived;

    // Credit card fields (null for non-credit-card accounts)
    private BigDecimal creditLimit;
    private BigDecimal availableCredit;
    private Integer    statementDay;
    private Integer    paymentDueDay;
    private BigDecimal apr;
    private LocalDate  nextStatementDate;
    private LocalDate  nextDueDate;
}
