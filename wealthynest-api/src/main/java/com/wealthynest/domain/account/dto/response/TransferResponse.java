package com.wealthynest.domain.account.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class TransferResponse {
    private UUID       id;
    private UUID       fromAccountId;
    private String     fromAccountName;
    private UUID       toAccountId;
    private String     toAccountName;
    private BigDecimal amount;
    private String     description;
    private LocalDate  transferDate;
    private Instant    createdAt;
}
