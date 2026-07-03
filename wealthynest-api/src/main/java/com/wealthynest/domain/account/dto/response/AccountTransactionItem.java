package com.wealthynest.domain.account.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Builder
public class AccountTransactionItem {
    private String     id;
    private String     type;        // INCOME, EXPENSE, TRANSFER_IN, TRANSFER_OUT
    private String     label;       // income source: SALARY, DIVIDEND, INTEREST, etc.
    private String     source;      // MANUAL | INVESTMENT (whether auto-credited from investment)
    private BigDecimal amount;
    private LocalDate  date;
    private String     description;
}
