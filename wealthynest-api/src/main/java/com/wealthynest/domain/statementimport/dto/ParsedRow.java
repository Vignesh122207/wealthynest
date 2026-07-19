package com.wealthynest.domain.statementimport.dto;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder
public class ParsedRow {
    private int         rowIndex;
    private LocalDate   date;
    private String      description;
    private BigDecimal  amount;
    /** DEBIT (money out — a candidate expense) or CREDIT (money in — a candidate income). */
    private String      type;
    private UUID         suggestedCategoryId;
    private String       suggestedCategoryName;
    private boolean       valid;
    private String        error;
}
