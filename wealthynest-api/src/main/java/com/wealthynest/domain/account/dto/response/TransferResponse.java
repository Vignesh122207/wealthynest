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
    // Not "isAdjustment"/"isDebt" — Lombok keeps the isXxx() getter for either spelling, and
    // Jackson always strips that "is" prefix when deriving the JSON key, so the field on the
    // wire is "adjustment"/"debt" either way. Naming the field to match avoids the mismatch.
    private boolean    adjustment;
    private boolean    debt;
    private String     debtContactName;
    private String     debtLabel;
    private LocalDate  transferDate;
    private Instant    createdAt;
}
