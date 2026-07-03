package com.wealthynest.domain.recurringincome.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecurringIncomeResponse {
    private UUID          id;
    private UUID          accountId;
    private String        accountName;
    private String        source;
    private BigDecimal    amount;
    private String        description;
    private int           dayOfMonth;
    private boolean       active;
    private Integer       lastCreditedMonth;
    private LocalDateTime lastCreditedAt;
    private Instant       createdAt;
}
