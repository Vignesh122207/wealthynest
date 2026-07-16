package com.wealthynest.domain.expensesplit.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
public class SplitParticipantRequest {
    @NotNull private UUID userId;
    @NotNull @Positive private BigDecimal shareAmount;
}
