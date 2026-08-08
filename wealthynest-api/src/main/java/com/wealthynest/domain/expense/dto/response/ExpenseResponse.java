package com.wealthynest.domain.expense.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class ExpenseResponse {
    private UUID       id;
    private UUID       userId;
    private UUID       familyId;
    private UUID       categoryId;
    private UUID       budgetId;
    private UUID       accountId;
    private String     categoryName;
    private String     categoryIcon;
    private String     categoryColor;
    private BigDecimal amount;
    private String     currency;
    private String     description;
    private String     notes;
    private LocalDate  expenseDate;
    private boolean    recurring;
    private boolean    debt;
    private String     recurrenceRule;
    private String     paymentMethod;
    private Instant    createdAt;
    private Double     latitude;
    private Double     longitude;
}
