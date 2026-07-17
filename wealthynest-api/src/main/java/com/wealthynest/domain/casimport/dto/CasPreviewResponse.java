package com.wealthynest.domain.casimport.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter @Builder
public class CasPreviewResponse {
    /** True when the uploaded PDF is password-protected and no (or a wrong) password was
     * supplied — holdings is empty in that case; the frontend should prompt for a password. */
    private boolean                needsPassword;
    private List<CasParsedHolding> holdings;
}
