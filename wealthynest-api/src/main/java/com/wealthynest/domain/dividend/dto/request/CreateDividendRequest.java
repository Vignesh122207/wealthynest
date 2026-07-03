package com.wealthynest.domain.dividend.dto.request;

import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class CreateDividendRequest {
    @NotNull private UUID investmentId;
    @NotNull @Positive private BigDecimal amount;
    @NotNull private LocalDate dividendDate;
    @PositiveOrZero private BigDecimal taxDeducted;
    private String notes;
}
