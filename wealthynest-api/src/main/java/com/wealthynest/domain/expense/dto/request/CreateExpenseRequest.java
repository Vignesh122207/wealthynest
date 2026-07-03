package com.wealthynest.domain.expense.dto.request;

import com.wealthynest.domain.expense.entity.PaymentMethod;
import jakarta.validation.constraints.*;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class CreateExpenseRequest {
    @NotNull private UUID categoryId;
    private UUID budgetId;
    @NotNull private UUID accountId;
    @NotNull @Positive private BigDecimal amount;
    @Size(max = 255) private String description;
    private String notes;
    @NotNull private LocalDate expenseDate;
    private boolean recurring;
    private String recurrenceRule;
    private PaymentMethod paymentMethod;
}
