package com.wealthynest.domain.statementimport.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter @Builder
public class StatementImportResultResponse {
    private int          created;
    private int          failed;
    private List<String> errors;
}
