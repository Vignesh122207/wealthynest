package com.wealthynest.domain.statementimport.dto;

import lombok.Getter;
import lombok.Setter;

/** Column indices (0-based) into the CSV header row, supplied by the user when auto-detection
 * can't confidently identify a bank's export format. Either debitColumn/creditColumn (separate
 * columns) or amountColumn (one signed/typed column) should be set, not both. */
@Getter @Setter
public class ColumnMapping {
    private Integer dateColumn;
    private Integer descriptionColumn;
    private Integer debitColumn;
    private Integer creditColumn;
    private Integer amountColumn;
}
