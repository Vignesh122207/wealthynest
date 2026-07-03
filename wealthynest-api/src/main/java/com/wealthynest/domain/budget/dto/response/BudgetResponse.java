package com.wealthynest.domain.budget.dto.response;

import com.wealthynest.domain.budget.entity.BudgetType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class BudgetResponse {
    private UUID       id;
    private UUID       categoryId;
    private String     categoryName;
    private String     categoryIcon;
    private String     categoryColor;
    private BigDecimal amount;
    private BigDecimal spent;
    private BigDecimal remaining;
    private double     percentUsed;
    private boolean    overBudget;
    private int        periodMonth;
    private int        periodYear;
    private BigDecimal alertThreshold;
    private boolean    alertTriggered;
    private BudgetType budgetType;
}
