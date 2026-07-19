package com.wealthynest.infra.external;

import com.wealthynest.domain.investment.dto.response.InvestmentSearchResult;
import com.wealthynest.domain.investment.entity.MfMaster;
import com.wealthynest.domain.investment.repository.MfMasterRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExternalPriceServiceImplTest {

    @Mock private MfMasterRepository mfMasterRepository;

    private RestClient mfApiClient;
    private RestClient swissquoteClient;
    private RestClient forexClient;
    private RestClient frankfurterClient;
    private RestClient yahooClient;

    private ExternalPriceServiceImpl service;

    @BeforeEach
    void setUp() {
        // Deep-stubbed: each RestClient bean's get().uri(...).retrieve().body(...) chain is faked
        // per test via targeted stubs; unstubbed chains resolve to null instead of NPE-ing.
        mfApiClient       = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        swissquoteClient  = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        forexClient       = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        frankfurterClient = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        yahooClient       = mock(RestClient.class, Answers.RETURNS_DEEP_STUBS);
        service = new ExternalPriceServiceImpl(mfMasterRepository, mfApiClient, swissquoteClient,
                forexClient, frankfurterClient, yahooClient);
    }

    private void stubSwissquoteXauUsd(BigDecimal bid, BigDecimal ask) {
        String raw = "[{\"spreadProfilePrices\":[{\"bid\":" + bid + ",\"ask\":" + ask + "}]}]";
        when(swissquoteClient.get().uri(anyString()).retrieve().body(String.class)).thenReturn(raw);
    }

    private void stubYahooChartPrice(BigDecimal price) {
        Map<String, Object> meta = Map.of("regularMarketPrice", price);
        Map<String, Object> result = Map.of("meta", meta);
        Map<String, Object> chart = Map.of("result", List.of(result));
        Map<String, Object> body = Map.of("chart", chart);
        when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class)).thenReturn(body);
    }

    // The XAU/USD Yahoo fallback (fetchXauUsd, GC=F) calls a no-vararg .uri(String) and reads the
    // body as a raw String (then hand-parses it) — unlike every other Yahoo call in this class,
    // which uses .uri(String, Object...) and .body(Map.class) directly.
    private void stubYahooGcFRawJson(BigDecimal price) {
        String raw = "{\"chart\":{\"result\":[{\"meta\":{\"regularMarketPrice\":" + price + "}}]}}";
        when(yahooClient.get().uri(anyString()).retrieve().body(String.class)).thenReturn(raw);
    }

    private void stubForexInr(String inrRate) {
        Map<String, Object> resp = Map.of("rates", Map.of("INR", inrRate));
        when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(resp);
    }

    private void stubFrankfurterInr(String inrRate) {
        Map<String, Object> resp = Map.of("rates", Map.of("INR", inrRate));
        when(frankfurterClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(resp);
    }

    // ─── Gold price ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("fetchGoldPriceData / fetchGoldPrice22k")
    class GoldPriceTests {

        @Test
        @DisplayName("computes 22k/24k/18k prices from Swissquote XAU/USD and open.er-api USD/INR")
        void successViaSwissquoteAndForex() {
            stubSwissquoteXauUsd(new BigDecimal("4000"), new BigDecimal("4010"));
            stubForexInr("85");

            ExternalPriceService.GoldPriceData data = service.fetchGoldPriceData();

            assertThat(data).isNotNull();
            assertThat(data.spotUsd()).isEqualByComparingTo("4005"); // (4000+4010)/2
            assertThat(data.usdInr()).isEqualByComparingTo("85");
            assertThat(data.price24k()).isGreaterThan(BigDecimal.ZERO);
            // 22k must be less than 24k, 18k less than 22k
            assertThat(data.price22k()).isLessThan(data.price24k());
            assertThat(data.price18k()).isLessThan(data.price22k());
        }

        @Test
        @DisplayName("falls back to Yahoo GC=F when Swissquote XAU/USD fails")
        void yahooFallbackWhenSwissquoteFails() {
            when(swissquoteClient.get().uri(anyString()).retrieve().body(String.class))
                    .thenThrow(new RuntimeException("swissquote down"));
            stubYahooGcFRawJson(new BigDecimal("4005"));
            stubForexInr("85");

            ExternalPriceService.GoldPriceData data = service.fetchGoldPriceData();

            assertThat(data).isNotNull();
            assertThat(data.spotUsd()).isEqualByComparingTo("4005.0000");
        }

        @Test
        @DisplayName("returns null (and caches nothing) when both XAU/USD sources fail")
        void nullWhenBothXauSourcesFail() {
            when(swissquoteClient.get().uri(anyString()).retrieve().body(String.class))
                    .thenThrow(new RuntimeException("swissquote down"));
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenReturn(null);

            assertThat(service.fetchGoldPriceData()).isNull();
        }

        @Test
        @DisplayName("falls back to Frankfurter when open.er-api USD/INR has no rates")
        void frankfurterFallbackWhenForexFails() {
            stubSwissquoteXauUsd(new BigDecimal("4000"), new BigDecimal("4010"));
            when(forexClient.get().uri(anyString()).retrieve().body(Map.class))
                    .thenThrow(new RuntimeException("forex down"));
            stubFrankfurterInr("86");

            ExternalPriceService.GoldPriceData data = service.fetchGoldPriceData();

            assertThat(data).isNotNull();
            assertThat(data.usdInr()).isEqualByComparingTo("86");
        }

        @Test
        @DisplayName("returns null when XAU succeeds but both USD/INR sources fail")
        void nullWhenBothForexSourcesFail() {
            stubSwissquoteXauUsd(new BigDecimal("4000"), new BigDecimal("4010"));
            when(forexClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(null);
            when(frankfurterClient.get().uri(anyString()).retrieve().body(Map.class)).thenReturn(null);

            assertThat(service.fetchGoldPriceData()).isNull();
        }

        @Test
        @DisplayName("a second call within the TTL window returns the cached value without a new fetch")
        void cachedWithinTtlDoesNotRefetch() {
            stubSwissquoteXauUsd(new BigDecimal("4000"), new BigDecimal("4010"));
            stubForexInr("85");

            ExternalPriceService.GoldPriceData first = service.fetchGoldPriceData();
            ExternalPriceService.GoldPriceData second = service.fetchGoldPriceData();

            assertThat(second).isSameAs(first);
            // 1 invocation from the stub setup above + 1 from the single real fetch (the cached
            // second call adds none) — deep-stub `when(...)` calls count as real invocations too.
            verify(swissquoteClient, times(2)).get();
        }

        @Test
        @DisplayName("fetchGoldPriceDataFresh bypasses the TTL cache and re-fetches")
        void freshBypassesCache() {
            stubSwissquoteXauUsd(new BigDecimal("4000"), new BigDecimal("4010"));
            stubForexInr("85");
            service.fetchGoldPriceData();

            service.fetchGoldPriceDataFresh();

            // 1 stub setup + 1 first fetch + 1 forced fresh re-fetch
            verify(swissquoteClient, times(3)).get();
        }

        @Test
        @DisplayName("fetchGoldPrice22k delegates to fetchGoldPriceData and extracts price22k")
        void fetchGoldPrice22kDelegates() {
            stubSwissquoteXauUsd(new BigDecimal("4000"), new BigDecimal("4010"));
            stubForexInr("85");

            assertThat(service.fetchGoldPrice22k()).isNotNull();
        }

        @Test
        @DisplayName("fetchGoldPrice22k returns null when the underlying fetch fails")
        void fetchGoldPrice22kNullOnFailure() {
            when(swissquoteClient.get().uri(anyString()).retrieve().body(String.class))
                    .thenThrow(new RuntimeException("down"));
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenReturn(null);

            assertThat(service.fetchGoldPrice22k()).isNull();
        }
    }

    // ─── MF master sync ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("syncMfMaster")
    class SyncMfMasterTests {

        @Test
        @DisplayName("truncates and re-saves the full scheme list, returning the distinct-code count")
        void successfulSync() {
            List<Map<String, Object>> results = List.of(
                    Map.of("schemeCode", "101", "schemeName", "Axis Bluechip"),
                    Map.of("schemeCode", "102", "schemeName", "HDFC Top 100")
            );
            when(mfApiClient.get().uri(anyString()).retrieve().body(List.class)).thenReturn(results);
            when(mfMasterRepository.count()).thenReturn(2L);

            int synced = service.syncMfMaster();

            assertThat(synced).isEqualTo(2);
            verify(mfMasterRepository).truncate();
            verify(mfMasterRepository).saveAll(any());
        }

        @Test
        @DisplayName("skips entries missing schemeCode or schemeName before saving")
        void filtersIncompleteEntries() {
            List<Map<String, Object>> results = new java.util.ArrayList<>();
            results.add(Map.of("schemeCode", "101", "schemeName", "Axis Bluechip"));
            Map<String, Object> missingName = new java.util.HashMap<>();
            missingName.put("schemeCode", "102");
            missingName.put("schemeName", null);
            results.add(missingName);
            when(mfApiClient.get().uri(anyString()).retrieve().body(List.class)).thenReturn(results);
            when(mfMasterRepository.count()).thenReturn(1L);

            service.syncMfMaster();

            @SuppressWarnings("unchecked")
            org.mockito.ArgumentCaptor<List<MfMaster>> captor = org.mockito.ArgumentCaptor.forClass(List.class);
            verify(mfMasterRepository).saveAll(captor.capture());
            assertThat(captor.getValue()).hasSize(1);
        }

        @Test
        @DisplayName("returns 0 and leaves the table untouched when the API returns an empty list")
        void emptyResultsLeaveTableUntouched() {
            when(mfApiClient.get().uri(anyString()).retrieve().body(List.class)).thenReturn(List.of());

            assertThat(service.syncMfMaster()).isEqualTo(0);
            verify(mfMasterRepository, never()).truncate();
            verify(mfMasterRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("returns 0 when the API call throws")
        void returnsZeroOnException() {
            when(mfApiClient.get().uri(anyString()).retrieve().body(List.class))
                    .thenThrow(new RuntimeException("mfapi.in down"));

            assertThat(service.syncMfMaster()).isEqualTo(0);
            verify(mfMasterRepository, never()).truncate();
        }
    }

    // ─── fetchMFNav ─────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("fetchMFNav")
    class FetchMfNavTests {

        @Test
        @DisplayName("parses nav, date, scheme name and fund house from a successful response")
        void successfulFetch() {
            Map<String, Object> body = Map.of(
                    "meta", Map.of("scheme_name", "Axis Bluechip", "fund_house", "Axis MF"),
                    "data", List.of(Map.of("nav", "45.67", "date", "01-01-2025"))
            );
            when(mfApiClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class)).thenReturn(body);

            ExternalPriceService.MFNavData nav = service.fetchMFNav("101");

            assertThat(nav.nav()).isEqualByComparingTo("45.67");
            assertThat(nav.navDate()).isEqualTo("01-01-2025");
            assertThat(nav.schemeName()).isEqualTo("Axis Bluechip");
        }

        @Test
        @DisplayName("returns null when the data list is empty")
        void nullWhenDataEmpty() {
            Map<String, Object> body = Map.of("meta", Map.of(), "data", List.of());
            when(mfApiClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class)).thenReturn(body);

            assertThat(service.fetchMFNav("101")).isNull();
        }

        @Test
        @DisplayName("returns null when the response body itself is null")
        void nullWhenBodyNull() {
            when(mfApiClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class)).thenReturn(null);

            assertThat(service.fetchMFNav("101")).isNull();
        }

        @Test
        @DisplayName("returns null when the call throws")
        void nullOnException() {
            when(mfApiClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenThrow(new RuntimeException("timeout"));

            assertThat(service.fetchMFNav("101")).isNull();
        }
    }

    // ─── fetchStockPrice ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("fetchStockPrice")
    class FetchStockPriceTests {

        @Test
        @DisplayName("appends .NS suffix when the symbol has no exchange suffix")
        void appendsNsSuffix() {
            stubYahooChartPrice(new BigDecimal("3500"));

            BigDecimal price = service.fetchStockPrice("TCS");

            assertThat(price).isEqualByComparingTo("3500.0000");
        }

        @Test
        @DisplayName("does not double-append when the symbol already has a .BO suffix")
        void keepsExistingBoSuffix() {
            stubYahooChartPrice(new BigDecimal("100"));

            assertThat(service.fetchStockPrice("RELIANCE.BO")).isEqualByComparingTo("100.0000");
        }

        @Test
        @DisplayName("returns null when the call throws")
        void nullOnException() {
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenThrow(new RuntimeException("yahoo down"));

            assertThat(service.fetchStockPrice("TCS")).isNull();
        }
    }

    // ─── searchBSEStocks ────────────────────────────────────────────────────────

    @Nested
    @DisplayName("searchBSEStocks")
    class SearchBseStocksTests {

        @Test
        @DisplayName("keeps only .BO EQUITY quotes and strips the .BO suffix")
        void filtersToBseEquityOnly() {
            Map<String, Object> body = Map.of("quotes", List.of(
                    Map.of("symbol", "RELIANCE.BO", "quoteType", "EQUITY", "longname", "Reliance Industries"),
                    Map.of("symbol", "TCS.NS", "quoteType", "EQUITY"), // wrong exchange -> excluded
                    Map.of("symbol", "SOMEFUND.BO", "quoteType", "MUTUALFUND") // wrong type -> excluded
            ));
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class)).thenReturn(body);

            List<InvestmentSearchResult> results = service.searchBSEStocks("reliance");

            assertThat(results).hasSize(1);
            assertThat(results.get(0).getSymbol()).isEqualTo("RELIANCE");
            assertThat(results.get(0).getExchange()).isEqualTo("BSE");
        }

        @Test
        @DisplayName("returns an empty list when the response has no quotes key")
        void emptyWhenNoQuotesKey() {
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenReturn(Map.of("other", "value"));

            assertThat(service.searchBSEStocks("x")).isEmpty();
        }

        @Test
        @DisplayName("returns an empty list when the call throws")
        void emptyOnException() {
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenThrow(new RuntimeException("yahoo down"));

            assertThat(service.searchBSEStocks("x")).isEmpty();
        }
    }

    // ─── fetchDividendHistory ───────────────────────────────────────────────────

    @Nested
    @DisplayName("fetchDividendHistory")
    class FetchDividendHistoryTests {

        @Test
        @DisplayName("parses ex-date/amount pairs from a successful chart response")
        void parsesDividendEvents() {
            long epoch = Instant.parse("2025-03-01T10:00:00Z").getEpochSecond();
            Map<String, Object> dividendEntry = Map.of("amount", "5.5", "date", epoch);
            Map<String, Object> dividends = Map.of("key1", dividendEntry);
            Map<String, Object> events = Map.of("dividends", dividends);
            Map<String, Object> result = Map.of("meta", Map.of(), "events", events);
            Map<String, Object> chart = Map.of("result", List.of(result));
            Map<String, Object> body = Map.of("chart", chart);
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class)).thenReturn(body);

            Map<String, BigDecimal> history = service.fetchDividendHistory("TCS", 0L);

            assertThat(history).hasSize(1);
            assertThat(history.values().iterator().next()).isEqualByComparingTo("5.5000");
        }

        @Test
        @DisplayName("a successful response with no events yields an empty map, not a retry")
        void emptyMapWhenBodyNull() {
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenReturn(null);

            assertThat(service.fetchDividendHistory("TCS", 0L)).isEmpty();
            verify(yahooClient, times(2)).get(); // 1 stub setup + 1 real call
        }

        @Test
        @DisplayName("throws after exhausting all retry attempts on repeated transient failures")
        void throwsAfterExhaustingRetries() {
            when(yahooClient.get().uri(anyString(), any(Object[].class)).retrieve().body(Map.class))
                    .thenThrow(new RuntimeException("rate limited"));

            assertThatThrownBy(() -> service.fetchDividendHistory("TCS", 0L))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("Dividend history unavailable for TCS");
            verify(yahooClient, times(4)).get(); // 1 stub setup + (1 initial + 2 retries)
        }
    }
}
