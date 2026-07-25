package com.wealthynest.domain.notification.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class UpdateNotificationPreferenceRequest {
    @NotNull private Boolean budgetAlertEnabled;
    @NotNull private Boolean lowBalanceEnabled;
    @NotNull private Boolean spendAnomalyEnabled;
    @NotNull private Boolean debtDueEnabled;
    @NotNull private Boolean loanEmiEnabled;
}
