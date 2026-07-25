package com.wealthynest.domain.notification.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_preferences")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class NotificationPreference {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "budget_alert_enabled", nullable = false)  @Builder.Default private boolean budgetAlertEnabled = true;
    @Column(name = "low_balance_enabled", nullable = false)   @Builder.Default private boolean lowBalanceEnabled = true;
    @Column(name = "spend_anomaly_enabled", nullable = false) @Builder.Default private boolean spendAnomalyEnabled = true;
    @Column(name = "debt_due_enabled", nullable = false)      @Builder.Default private boolean debtDueEnabled = true;
    @Column(name = "loan_emi_enabled", nullable = false)      @Builder.Default private boolean loanEmiEnabled = true;

    @Column(name = "created_at", updatable = false, nullable = false)
    @Builder.Default private Instant createdAt = Instant.now();

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
