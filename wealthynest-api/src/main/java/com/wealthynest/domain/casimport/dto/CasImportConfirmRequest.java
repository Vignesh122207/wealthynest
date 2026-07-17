package com.wealthynest.domain.casimport.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter @Setter
public class CasImportConfirmRequest {
    @NotEmpty @Valid
    private List<CasConfirmRowRequest> rows;
}
