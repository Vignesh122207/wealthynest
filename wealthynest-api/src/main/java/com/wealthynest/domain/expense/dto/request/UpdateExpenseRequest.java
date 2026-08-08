package com.wealthynest.domain.expense.dto.request;

import com.wealthynest.domain.expense.entity.PaymentMethod;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
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
    @DecimalMin("-90.0")  @DecimalMax("90.0")  private Double latitude;
    @DecimalMin("-180.0") @DecimalMax("180.0") private Double longitude;
}
