package com.wealthynest.domain.account.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import java.math.BigDecimal;

@Getter
public class AdjustBalanceRequest {
    /** Negative-balance rejection for non-liability accounts happens in the service layer, where
     * the account's own type is known — this only guarantees a value was actually sent. */
    @NotNull
    private BigDecimal targetBalance;
}
