package com.wealthynest.domain.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class BudgetSummaryResponse {
    private UUID       categoryId;
    private String     categoryName;
    private String     categoryColor;
    private BigDecimal budgeted;
    private BigDecimal spent;
    private double     percentUsed;
    private boolean    overBudget;
}
