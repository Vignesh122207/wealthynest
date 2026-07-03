package com.wealthynest.domain.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.List;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class DashboardResponse {
    private BigDecimal                     totalNetWorth;
    private BigDecimal                     monthlyExpenses;
    private BigDecimal                     monthlyIncome;
    private BigDecimal                     savingsRate;
    private BigDecimal                     totalInvested;
    private BigDecimal                     totalInvestmentValue;
    private BigDecimal                     totalDividendIncome;
    private List<CategorySpendingResponse> categoryBreakdown;
    private List<BudgetSummaryResponse>    budgetSummaries;
    private List<MonthlyTrendResponse>     monthlyTrend;
}
