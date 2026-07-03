package com.wealthynest.domain.family.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class FamilyMonthlyStatsResponse {
    private BigDecimal totalIncome;
    private BigDecimal totalExpense;
    private BigDecimal savings;
    private String     highestSpenderName;
    private BigDecimal highestSpenderAmount;
}
