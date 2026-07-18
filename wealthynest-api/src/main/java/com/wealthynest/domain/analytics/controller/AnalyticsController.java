package com.wealthynest.domain.analytics.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.analytics.dto.response.DashboardResponse;
import com.wealthynest.domain.analytics.dto.response.MonthlyTrendResponse;
import com.wealthynest.domain.analytics.service.AnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
public class AnalyticsController {
    private final AnalyticsService analyticsService;

    @GetMapping("/dashboard")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(
            @RequestParam(defaultValue = "0") int year,
            @RequestParam(defaultValue = "0") int month) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        LocalDate now = LocalDate.now();
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getDashboard(
                userId,
                year  == 0 ? now.getYear()      : year,
                month == 0 ? now.getMonthValue() : month)));
    }

    @GetMapping("/annual")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<MonthlyTrendResponse>>> getAnnualTrend(
            @RequestParam(defaultValue = "0") int year) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        int  y      = year == 0 ? LocalDate.now().getYear() : year;
        return ResponseEntity.ok(ApiResponse.success(analyticsService.getAnnualTrend(userId, y)));
    }
}
