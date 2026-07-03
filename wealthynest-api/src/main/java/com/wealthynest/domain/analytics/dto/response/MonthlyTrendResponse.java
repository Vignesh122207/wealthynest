package com.wealthynest.domain.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class MonthlyTrendResponse {
    private int        year;
    private int        month;
    private String     label;
    private BigDecimal income;
    private BigDecimal expenses;
    private BigDecimal saved;
}
