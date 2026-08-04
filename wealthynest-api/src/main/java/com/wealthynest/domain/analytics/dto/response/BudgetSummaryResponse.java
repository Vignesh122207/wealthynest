package com.wealthynest.domain.analytics.dto.response;

import com.wealthynest.domain.budget.entity.BudgetType;
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
    private String     categoryIcon;
    // A category can have both a MONTHLY and a YEARLY budget at once — callers that key/dedupe
    // notifications off this response must include budgetType, not just categoryId, or two
    // distinct breached budgets for the same category collide into one indistinguishable alert.
    private BudgetType budgetType;
    private BigDecimal budgeted;
    private BigDecimal spent;
    private double     percentUsed;
    private boolean    overBudget;
    // Annual-pace status — see AnalyticsServiceImpl#getDashboard's own comment. Only consumed by
    // the Home dashboard's combined (MONTHLY + YEARLY) Budget Progress ring; every other
    // consumer of this response (Budgets page, BudgetSection, notifications) should keep using
    // overBudget/spent/percentUsed, which stay scoped to this budget's own period.
    private boolean    paceOverBudget;
}
