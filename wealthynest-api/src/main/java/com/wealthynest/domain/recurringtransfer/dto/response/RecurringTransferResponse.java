package com.wealthynest.domain.recurringtransfer.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecurringTransferResponse {
    private UUID          id;
    private UUID          fromAccountId;
    private String        fromAccountName;
    private UUID          toAccountId;
    private String        toAccountName;
    private BigDecimal    amount;
    private String        description;
    private int           dayOfMonth;
    private boolean       active;
    private Integer       lastTransferredMonth;
    private LocalDateTime lastTransferredAt;
    private Instant       createdAt;
}
