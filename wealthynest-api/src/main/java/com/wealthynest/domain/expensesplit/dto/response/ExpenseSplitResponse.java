package com.wealthynest.domain.expensesplit.dto.response;

import com.wealthynest.domain.expensesplit.entity.SplitStatus;
import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder
public class ExpenseSplitResponse {
    private UUID       id;
    private UUID       expenseId;
    private String     expenseDescription;
    private String     categoryName;
    private LocalDate  expenseDate;
    private UUID       payerUserId;
    private String     payerName;
    private UUID       participantUserId;
    private String     participantName;
    private BigDecimal shareAmount;
    private SplitStatus status;
    private Instant    settledAt;
}
