package com.wealthynest.domain.expense.entity;

import com.wealthynest.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "expenses")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Expense extends BaseEntity {
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "family_id") private UUID familyId;
    @Column(name = "category_id", nullable = false) private UUID categoryId;
    @Column(name = "budget_id")  private UUID budgetId;
    @Column(name = "account_id") private UUID accountId;
    @Column(nullable = false, precision = 14, scale = 2) private BigDecimal amount;
    @Column(nullable = false, length = 3) @Builder.Default private String currency = "INR";
    @Column(length = 255) private String description;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "expense_date", nullable = false) private LocalDate expenseDate;
    @Column(name = "is_recurring", nullable = false) @Builder.Default private boolean recurring = false;
    @Column(name = "is_debt",      nullable = false) @Builder.Default private boolean debt      = false;
    @Column(name = "recurrence_rule", length = 50) private String recurrenceRule;
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 30) private PaymentMethod paymentMethod;
    /** Opt-in, per-transaction — captured only when the user taps "Add current location" in the
     * expense form. Raw coordinates only (Tier 1: no reverse geocoding, no embedded map). */
    @Column private Double latitude;
    @Column private Double longitude;
}
