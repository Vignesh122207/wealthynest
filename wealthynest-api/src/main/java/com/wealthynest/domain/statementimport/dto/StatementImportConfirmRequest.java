package com.wealthynest.domain.statementimport.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import java.util.List;
import java.util.UUID;

@Getter
public class StatementImportConfirmRequest {
    @NotNull  private UUID accountId;
    @NotEmpty @Valid private List<ConfirmRowRequest> rows;
}
