package com.wealthynest.domain.debt.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class DebtPaymentResponse {
    private UUID       id;
    private BigDecimal amount;
    private String     note;
    private Instant    paidAt;
}
