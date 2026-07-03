package com.wealthynest.domain.income.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class IncomeResponse {
    private UUID       id;
    private UUID       accountId;
    private String     source;
    private String     paymentMode;
    private BigDecimal amount;
    private String     description;
    private LocalDate  incomeDate;
    private int        periodMonth;
    private int        periodYear;
    private boolean    debt;
    private Instant    createdAt;
}
