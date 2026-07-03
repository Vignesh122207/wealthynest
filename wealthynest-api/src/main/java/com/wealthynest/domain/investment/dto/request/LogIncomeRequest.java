package com.wealthynest.domain.investment.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class LogIncomeRequest {
    @NotNull private String     incomeType;   // "DIVIDEND"
    @NotNull private String     exDate;       // ISO date yyyy-MM-dd
    @NotNull @Positive private BigDecimal amount;
    private BigDecimal perShare;
    private BigDecimal shares;
}
