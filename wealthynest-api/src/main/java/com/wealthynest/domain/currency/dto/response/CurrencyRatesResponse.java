package com.wealthynest.domain.currency.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** 1 unit of {@code base} converts to {@code rates.get(code)} units of that currency —
 * e.g. base="INR", rates={"USD": 0.012} means ₹1 ≈ $0.012. {@code stale} is true when the last
 * live fetch failed and this is serving the previous successful result past its normal TTL. */
@Getter @Builder
public class CurrencyRatesResponse {
    private String base;
    private Map<String, BigDecimal> rates;
    private Instant fetchedAt;
    private boolean stale;
}
