package com.wealthynest.domain.expensesplit.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import java.util.List;

@Getter
public class AddSplitsRequest {
    @NotEmpty @Valid
    private List<SplitParticipantRequest> splitWith;
}
