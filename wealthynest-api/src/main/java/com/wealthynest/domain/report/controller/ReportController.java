package com.wealthynest.domain.report.controller;

import com.wealthynest.common.security.SecurityUtils;
import com.wealthynest.domain.report.dto.ReportCsv;
import com.wealthynest.domain.report.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/monthly")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> monthlyReport(@RequestParam int year, @RequestParam int month) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return csvResponse(reportService.generateMonthlyReport(userId, year, month));
    }

    @GetMapping("/annual")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> annualReport(@RequestParam int year) {
        UUID userId = SecurityUtils.requireCurrentUserId();
        return csvResponse(reportService.generateAnnualReport(userId, year));
    }

    private static ResponseEntity<byte[]> csvResponse(ReportCsv report) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=" + StandardCharsets.UTF_8.name()));
        headers.setContentDisposition(ContentDisposition.attachment().filename(report.filename()).build());
        return ResponseEntity.ok().headers(headers).body(report.content());
    }
}
