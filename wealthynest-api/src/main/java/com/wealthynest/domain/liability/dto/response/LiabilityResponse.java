package com.wealthynest.domain.liability.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder
public class LiabilityResponse {
    private UUID       id;
    private String     name;
    private String     liabilityType;
    private BigDecimal principalAmount;
    private BigDecimal outstandingAmount;
    private BigDecimal interestRate;
    private String     lenderName;
    private BigDecimal emiAmount;
    private LocalDate  startDate;
    private LocalDate  endDate;
    private String     notes;
    private boolean    active;
    private Instant    createdAt;
    private Instant    updatedAt;

    /** True for entries derived live from Accounts (loan accounts, credit-card dues) — edit at source. */
    private boolean    derived;
    private UUID       sourceAccountId;
}
