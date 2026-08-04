package com.wealthynest.domain.admin.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter @Builder
public class SystemSettingsResponse {
    private boolean loginAlertEmailEnabled;
}
