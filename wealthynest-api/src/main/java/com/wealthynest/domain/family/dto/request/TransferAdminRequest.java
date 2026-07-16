package com.wealthynest.domain.family.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Getter @NoArgsConstructor
public class TransferAdminRequest {
    @NotNull
    private UUID newAdminId;
}
