package com.wealthynest.domain.report.service;

import com.wealthynest.domain.report.dto.ReportCsv;
import java.util.UUID;

public interface ReportService {
    ReportCsv generateMonthlyReport(UUID userId, int year, int month);
    ReportCsv generateAnnualReport(UUID userId, int year);
}
