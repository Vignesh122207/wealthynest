package com.wealthynest.domain.casimport.dto;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;

/** One mutual fund holding extracted from a CAS PDF, before the user reviews/edits it. */
@Getter @Builder
public class CasParsedHolding {
    private int        rowIndex;
    private String     schemeName;
    /** Matched against the local mf_master table by name — null if no confident match. */
    private String     schemeCode;
    private String     folioNumber;
    private BigDecimal units;
    private BigDecimal nav;
    private BigDecimal currentValue;
    /** Best-effort — only populated when the CAS itself prints a cost/invested figure for this
     * scheme; many layouts don't, so the frontend should treat a null here as "please confirm". */
    private BigDecimal investedAmount;
    private boolean    valid;
    private String     error;
}
