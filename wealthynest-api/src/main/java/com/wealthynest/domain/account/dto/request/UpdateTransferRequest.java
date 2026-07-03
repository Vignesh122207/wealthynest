package com.wealthynest.domain.account.dto.request;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
public class UpdateTransferRequest {
    @Positive private BigDecimal amount;
    private LocalDate transferDate;
    @Size(max = 255) private String description;
}
