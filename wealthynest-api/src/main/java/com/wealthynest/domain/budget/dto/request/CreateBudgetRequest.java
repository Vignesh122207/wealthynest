package com.wealthynest.domain.budget.dto.request;

import com.wealthynest.domain.budget.entity.BudgetType;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class CreateBudgetRequest {
    @NotNull private UUID categoryId;
    @NotNull @Positive private BigDecimal amount;
    // period fields ignored — budgets are templates, period is provided at query time
    @Min(0) @Max(12) private Integer periodMonth;
    @Min(2020) @Max(2100) private Integer periodYear;
    @DecimalMin("1") @DecimalMax("100") private BigDecimal alertThreshold;
    private BudgetType budgetType;
}
