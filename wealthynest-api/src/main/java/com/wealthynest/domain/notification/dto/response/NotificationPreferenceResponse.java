package com.wealthynest.domain.notification.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter @Builder
public class NotificationPreferenceResponse {
    private boolean budgetAlertEnabled;
    private boolean lowBalanceEnabled;
    private boolean spendAnomalyEnabled;
    private boolean debtDueEnabled;
    private boolean loanEmiEnabled;
    private boolean sipReminderEnabled;
}
