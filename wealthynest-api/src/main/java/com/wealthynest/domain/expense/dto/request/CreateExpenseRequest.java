package com.wealthynest.domain.expense.dto.request;

import com.wealthynest.domain.expense.entity.PaymentMethod;
import com.wealthynest.domain.expensesplit.dto.request.SplitParticipantRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Getter @Setter
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
    /** Optional — other family members' shares of this expense (Splitwise-style). */
    @Valid private List<SplitParticipantRequest> splitWith;
    /** Optional, opt-in — set only when the user captured their current location in the form. */
    @DecimalMin("-90.0")  @DecimalMax("90.0")  private Double latitude;
    @DecimalMin("-180.0") @DecimalMax("180.0") private Double longitude;
}
