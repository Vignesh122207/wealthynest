package com.wealthynest.domain.report.dto;

/** A generated CSV report ready to stream back as a file download. */
public record ReportCsv(byte[] content, String filename) {
}
