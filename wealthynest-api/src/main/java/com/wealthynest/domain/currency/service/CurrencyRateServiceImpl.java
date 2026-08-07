package com.wealthynest.domain.currency.service;

import com.wealthynest.domain.currency.dto.response.CurrencyRatesResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Real INR→USD/EUR conversion rates for the Transactions page's currency toggle — every amount in
 * this app is entered and stored in INR, so a currency "preference" that just relabels the same
 * number with a different symbol (see lib/utils.ts's formatCurrency on the frontend) would show a
 * wrong figure the moment real conversion is expected. Reuses the same forexClient/frankfurterClient
 * beans (and cache-with-retry-backoff shape) already proven out by ExternalPriceServiceImpl's gold
 * price fetch, rather than standing up a new external integration from scratch.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CurrencyRateServiceImpl implements CurrencyRateService {

    private final RestClient forexClient;       // open.er-api.com
    private final RestClient frankfurterClient;  // fallback

    private static final Duration CACHE_TTL     = Duration.ofHours(1);
    private static final Duration RETRY_BACKOFF = Duration.ofMinutes(15);
    private static final List<String> TARGET_CODES = List.of("USD", "EUR");

    private volatile CurrencyRatesResponse cached          = null;
    private volatile Instant              cacheExpiry      = Instant.EPOCH;
    private volatile Instant              nextRetryAfter   = Instant.EPOCH;

    @Override
    public CurrencyRatesResponse getRates() {
        Instant now = Instant.now();
        if (cached != null && now.isBefore(cacheExpiry)) {
            return cached;
        }
        if (now.isBefore(nextRetryAfter)) {
            return staleCopyOrNull();
        }

        Map<String, BigDecimal> rates = fetchFromOpenErApi();
        if (rates == null) rates = fetchFromFrankfurter();

        if (rates == null) {
            log.warn("INR currency rates unavailable from all sources; retrying in {} min", RETRY_BACKOFF.toMinutes());
            nextRetryAfter = now.plus(RETRY_BACKOFF);
            return staleCopyOrNull();
        }

        CurrencyRatesResponse fresh = CurrencyRatesResponse.builder()
                .base("INR").rates(rates).fetchedAt(now).stale(false).build();
        cached        = fresh;
        cacheExpiry   = now.plus(CACHE_TTL);
        nextRetryAfter = Instant.EPOCH;
        return fresh;
    }

    private CurrencyRatesResponse staleCopyOrNull() {
        if (cached == null) return null;
        return CurrencyRatesResponse.builder()
                .base(cached.getBase()).rates(cached.getRates()).fetchedAt(cached.getFetchedAt()).stale(true).build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> fetchFromOpenErApi() {
        try {
            Map<String, Object> resp = forexClient.get()
                    .uri("/v6/latest/INR")
                    .retrieve().body(Map.class);
            return extractTargetRates(resp);
        } catch (Exception e) {
            log.warn("open.er-api INR rates failed: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> fetchFromFrankfurter() {
        try {
            Map<String, Object> resp = frankfurterClient.get()
                    .uri("/latest?from=INR&to=USD,EUR")
                    .retrieve().body(Map.class);
            return extractTargetRates(resp);
        } catch (Exception e) {
            log.warn("Frankfurter INR rates fallback failed: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> extractTargetRates(Map<String, Object> resp) {
        if (resp == null) return null;
        Map<String, Object> raw = (Map<String, Object>) resp.get("rates");
        if (raw == null) return null;
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        for (String code : TARGET_CODES) {
            Object v = raw.get(code);
            if (v == null) return null; // partial response — treat as a failure, try the next source
            result.put(code, new BigDecimal(v.toString()));
        }
        return result;
    }
}
