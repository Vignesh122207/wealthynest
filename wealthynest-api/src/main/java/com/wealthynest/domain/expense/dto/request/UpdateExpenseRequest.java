package com.wealthynest.domain.expense.dto.request;

import com.wealthynest.domain.expense.entity.PaymentMethod;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter
public class UpdateExpenseRequest {
    private UUID categoryId;
    private UUID accountId;
    @Positive private BigDecimal amount;
    @Size(max = 255) private String description;
    private String notes;
    private LocalDate expenseDate;
    private Boolean recurring;
    private String recurrenceRule;
    private PaymentMethod paymentMethod;
}
