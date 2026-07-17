package com.wealthynest.domain.casimport.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

/** One holding as the user confirmed it in the review step — may differ from what was parsed
 * (they can edit any field, or add a row the parser missed entirely). */
@Getter @Setter
public class CasConfirmRowRequest {
    @NotBlank private String schemeName;
    private String schemeCode;
    private String folioNumber;
    @NotNull @Positive private BigDecimal units;
    @NotNull @Positive private BigDecimal nav;
    @NotNull @Positive private BigDecimal currentValue;
    /** Falls back to currentValue (i.e. zero assumed gain/loss) when the CAS didn't print a cost
     * figure and the user didn't correct it — flagged to them in the review UI either way. */
    private BigDecimal investedAmount;
}
