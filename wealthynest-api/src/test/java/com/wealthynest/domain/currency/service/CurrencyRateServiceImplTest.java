package com.wealthynest.domain.currency.service;

import com.wealthynest.domain.currency.dto.response.CurrencyRatesResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CurrencyRateServiceImplTest {

    private RestClient forexClient;
    private RestClient frankfurterClient;
    private CurrencyRateServiceImpl service;

    @BeforeEach
    void setUp() {
        forexClient       = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        frankfurterClient = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        service = new CurrencyRateServiceImpl(forexClient, frankfurterClient);
    }

    private void stubOpenErApi(String usd, String eur) {
        Map<String, Object> resp = Map.of("rates", Map.of("USD", usd, "EUR", eur));
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(resp);
    }

    private void stubFrankfurter(String usd, String eur) {
        Map<String, Object> resp = Map.of("rates", Map.of("USD", usd, "EUR", eur));
        when(frankfurterClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(resp);
    }

    @Test
    @DisplayName("returns INR-based rates for USD and EUR from the primary source")
    void returnsRatesFromPrimarySource() {
        stubOpenErApi("0.0120", "0.0110");

        CurrencyRatesResponse rates = service.getRates();

        assertThat(rates.getBase()).isEqualTo("INR");
        assertThat(rates.getRates().get("USD")).isEqualByComparingTo("0.0120");
        assertThat(rates.getRates().get("EUR")).isEqualByComparingTo("0.0110");
        assertThat(rates.isStale()).isFalse();
    }

    @Test
    @DisplayName("falls back to frankfurter.app when the primary source throws")
    void fallsBackToFrankfurterOnPrimaryFailure() {
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("timeout"));
        stubFrankfurter("0.0121", "0.0112");

        CurrencyRatesResponse rates = service.getRates();

        assertThat(rates.getRates().get("USD")).isEqualByComparingTo("0.0121");
        assertThat(rates.getRates().get("EUR")).isEqualByComparingTo("0.0112");
    }

    @Test
    @DisplayName("falls back to frankfurter.app when the primary response is missing a target currency")
    void fallsBackWhenPrimaryResponseIncomplete() {
        Map<String, Object> incomplete = Map.of("rates", Map.of("USD", "0.0120")); // no EUR
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(incomplete);
        stubFrankfurter("0.0121", "0.0112");

        CurrencyRatesResponse rates = service.getRates();

        assertThat(rates.getRates().get("EUR")).isEqualByComparingTo("0.0112");
    }

    @Test
    @DisplayName("caches a successful fetch — a second call within the TTL doesn't hit either source again")
    void cachesSuccessfulFetch() {
        stubOpenErApi("0.0120", "0.0110");

        service.getRates();
        service.getRates();

        // RETURNS_DEEP_STUBS records every invocation on the same mock instance, so verifying the
        // fixed stub above didn't reset between calls is enough proof only one real fetch happened —
        // a live volatile field re-check would need a second, different stubbed value to prove it.
        org.mockito.Mockito.verify(forexClient.get().uri(anyString()).retrieve(), org.mockito.Mockito.times(1)).body(Map.class);
    }

    @Test
    @DisplayName("returns null when both sources fail and there's no prior cached value")
    void returnsNullWhenNoSourceAvailableAndNoCache() {
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("down"));
        when(frankfurterClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("down"));

        assertThat(service.getRates()).isNull();
    }

    @Test
    @DisplayName("serves the last good rates, marked stale, when a later refresh fails")
    void servesStaleCacheWhenRefreshFails() {
        stubOpenErApi("0.0120", "0.0110");
        service.getRates(); // populate cache

        // Force the cache to be treated as expired without waiting out the real 1h TTL.
        ReflectionTestUtils.setField(service, "cacheExpiry", Instant.EPOCH);
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("down"));
        when(frankfurterClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("down"));

        CurrencyRatesResponse rates = service.getRates();

        assertThat(rates.isStale()).isTrue();
        assertThat(rates.getRates().get("USD")).isEqualByComparingTo(new BigDecimal("0.0120"));
    }

    @Test
    @DisplayName("after a failed refresh, retries are backed off instead of hitting the sources every call")
    void backsOffRetriesAfterFailure() {
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("down"));
        when(frankfurterClient.get().uri(anyString()).retrieve().body(Map.class)).thenThrow(new RuntimeException("down"));

        service.getRates();
        service.getRates();

        org.mockito.Mockito.verify(forexClient.get().uri(anyString()).retrieve(), org.mockito.Mockito.times(1)).body(Map.class);
    }
}
