package com.wealthynest.domain.casimport.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter @Builder
public class CasImportResultResponse {
    private int          created;
    private int          failed;
    private List<String> errors;
}
