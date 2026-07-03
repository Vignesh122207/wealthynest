package com.wealthynest.domain.analytics.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class CategorySpendingResponse {
    private UUID       categoryId;
    private String     categoryName;
    private String     categoryColor;
    private String     categoryIcon;
    private BigDecimal amount;
    private double     percentage;
}
