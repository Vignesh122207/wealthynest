package com.wealthynest.domain.networth.controller;

import com.wealthynest.common.response.ApiResponse;
import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.networth.dto.response.NetWorthHistoryPoint;
import com.wealthynest.domain.networth.dto.response.NetWorthSummaryResponse;
import com.wealthynest.domain.networth.service.NetWorthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Month;
import java.time.format.TextStyle;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/net-worth")
@RequiredArgsConstructor
public class NetWorthController {

    private final NetWorthService netWorthService;

    @GetMapping("/summary")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<NetWorthSummaryResponse>> getSummary() {
        return ResponseEntity.ok(ApiResponse.success(
                netWorthService.getSummary(
                        SecurityUtils.requireCurrentUserId(),
                        SecurityUtils.getCurrentFamilyId().orElse(null))));
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<NetWorthHistoryPoint>>> getHistory() {
        UUID userId = SecurityUtils.requireCurrentUserId();
        List<NetWorthHistoryPoint> points = netWorthService.getHistory(userId).stream()
                .map(s -> NetWorthHistoryPoint.builder()
                        .year(s.getYear())
                        .month(s.getMonth())
                        .label(Month.of(s.getMonth()).getDisplayName(TextStyle.SHORT, Locale.ENGLISH)
                                + " " + s.getYear())
                        .netWorth(s.getNetWorth())
                        .build())
                .toList();
        return ResponseEntity.ok(ApiResponse.success(points));
    }
}
