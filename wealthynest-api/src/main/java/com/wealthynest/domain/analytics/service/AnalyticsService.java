package com.wealthynest.domain.analytics.service;

import com.wealthynest.domain.analytics.dto.response.DashboardResponse;
import com.wealthynest.domain.analytics.dto.response.MonthlyTrendResponse;
import java.util.List;
import java.util.UUID;

public interface AnalyticsService {
    DashboardResponse getDashboard(UUID userId, int year, int month);
    List<MonthlyTrendResponse> getAnnualTrend(UUID userId, int year);
}
