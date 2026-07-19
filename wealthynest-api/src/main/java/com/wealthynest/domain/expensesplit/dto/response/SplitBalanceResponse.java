package com.wealthynest.domain.expensesplit.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter @Builder
public class SplitBalanceResponse {
    private UUID       counterpartUserId;
    private String     counterpartName;
    /** Positive = counterpart owes the current user; negative = current user owes counterpart. */
    private BigDecimal netAmount;
}
