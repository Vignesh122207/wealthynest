package com.wealthynest.domain.debt.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class DebtRecordResponse {
    private UUID                     id;
    private UUID                     accountId;
    private String                   accountName;
    private String                   type;
    private String                   contactName;
    private String                   contactPhone;
    private BigDecimal               amount;
    private String                   description;
    private LocalDate                debtDate;
    private LocalDate                dueDate;
    private String                   status;
    private BigDecimal               amountSettled;
    private BigDecimal               amountRemaining;
    private List<DebtPaymentResponse> payments;
    private Instant                  createdAt;
}
