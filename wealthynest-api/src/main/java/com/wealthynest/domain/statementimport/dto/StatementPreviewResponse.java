package com.wealthynest.domain.statementimport.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter @Builder
public class StatementPreviewResponse {
    /** True when auto-detection couldn't confidently identify the date/description/amount
     * columns — headers + sampleRows are populated so the frontend can offer manual mapping
     * and resubmit; rows is empty in that case. */
    private boolean            needsMapping;
    /** True when the uploaded PDF is password-protected and no (or a wrong) password was
     * supplied — rows/headers are empty in that case; the frontend should prompt for a
     * password and resubmit. */
    private boolean            needsPassword;
    private List<String>       headers;
    private List<List<String>> sampleRows;
    private List<ParsedRow>    rows;
}
