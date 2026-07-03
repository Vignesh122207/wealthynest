package com.wealthynest.domain.dividend.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder
public class BondInterestResponse {
    private UUID       id;
    private UUID       investmentId;
    private BigDecimal amount;
    private BigDecimal taxDeducted;
    private BigDecimal netAmount;
    private LocalDate  interestDate;
    private String     notes;
    private Instant    createdAt;
}
