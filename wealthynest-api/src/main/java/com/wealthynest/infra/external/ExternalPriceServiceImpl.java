package com.wealthynest.infra.external;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExternalPriceServiceImpl implements ExternalPriceService {

    private final RestClient mfApiClient;
    private final RestClient swissquoteClient;
    private final RestClient forexClient;        // open.er-api.com
    private final RestClient frankfurterClient;  // fallback for USD/INR
    private final RestClient yahooClient;        // query2.finance.yahoo.com — no crumb needed

    private static final double GRAMS_PER_OZ = 31.1035;

    private volatile GoldPriceData cachedGoldData     = null;
    private volatile Instant       goldCacheExpiry    = Instant.EPOCH;
    private volatile Instant       goldNextRetryAfter = Instant.EPOCH;
    private static final Duration  GOLD_CACHE_TTL     = Duration.ofHours(4);
    private static final Duration  GOLD_RETRY_BACKOFF = Duration.ofMinutes(30);

    // ── Gold price ────────────────────────────────────────────────────────────

    @Override
    public BigDecimal fetchGoldPrice22k() {
        GoldPriceData d = fetchGoldPriceData();
        return d != null ? d.price22k() : null;
    }

    // India retail gold price = international spot × INDIA_GOLD_FACTOR
    // Post-Jul 2024 duty cuts: basic customs 6% + AIDC 2.5% + SWS 0.6% + GST 3% + freight/insurance ~1% + MCX ~2%
    // = 1.06 × 1.025 × 1.006 × 1.03 × 1.03 ≈ 1.149
    // Calibrated: XAU/USD≈$4008 × USD/INR≈94.67 → 24K ≈ ₹14,013/g (Jun 2026)
    private static final BigDecimal INDIA_GOLD_FACTOR = new BigDecimal("1.149");

    @Override
    public GoldPriceData fetchGoldPriceData() {
        Instant now = Instant.now();
        if (cachedGoldData != null && now.isBefore(goldCacheExpiry)) {
            return cachedGoldData;
        }
        if (now.isBefore(goldNextRetryAfter)) {
            return cachedGoldData;
        }

        BigDecimal spotUsd = fetchXauUsd();
        if (spotUsd == null) {
            log.warn("Gold price unavailable from all sources; retrying in 30 min");
            goldNextRetryAfter = Instant.now().plus(GOLD_RETRY_BACKOFF);
            return cachedGoldData;
        }

        BigDecimal usdInr = fetchUsdInr();
        if (usdInr == null) {
            log.warn("USD/INR rate unavailable; retrying in 30 min");
            goldNextRetryAfter = Instant.now().plus(GOLD_RETRY_BACKOFF);
            return cachedGoldData;
        }

        // International spot in INR per gram (24K pure)
        BigDecimal intlPerGram = spotUsd.multiply(usdInr)
            .divide(BigDecimal.valueOf(GRAMS_PER_OZ), 4, RoundingMode.HALF_UP);

        // Apply India market factor (duty + GST + MCX premium)
        BigDecimal price24k = intlPerGram.multiply(INDIA_GOLD_FACTOR).setScale(2, RoundingMode.HALF_UP);
        BigDecimal price22k = price24k.multiply(BigDecimal.valueOf(22))
            .divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP);
        BigDecimal price18k = price24k.multiply(BigDecimal.valueOf(18))
            .divide(BigDecimal.valueOf(24), 2, RoundingMode.HALF_UP);

        log.info("Gold: XAU/USD={}, USD/INR={}, 24K=₹{}/g, 22K=₹{}/g, 18K=₹{}/g",
            spotUsd, usdInr, price24k, price22k, price18k);

        GoldPriceData data = new GoldPriceData(price22k, price24k, price18k, spotUsd, usdInr);
        cachedGoldData     = data;
        goldCacheExpiry    = Instant.now().plus(GOLD_CACHE_TTL);
        goldNextRetryAfter = Instant.EPOCH;
        return data;
    }

    /** Fetch XAU/USD spot price — tries Swissquote first, then Yahoo GC=F. */
    private BigDecimal fetchXauUsd() {
        try {
            String raw = swissquoteClient.get()
                .uri("/public-quotes/bboquotes/instrument/XAU/USD")
                .retrieve().body(String.class);
            if (raw != null && !raw.isBlank() && !raw.trim().startsWith("<")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> quotes =
                    new ObjectMapper().readValue(raw, new TypeReference<List<Map<String, Object>>>() {});
                if (quotes != null && !quotes.isEmpty()) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> prices =
                        (List<Map<String, Object>>) quotes.get(0).get("spreadProfilePrices");
                    if (prices != null && !prices.isEmpty()) {
                        BigDecimal bid = new BigDecimal(prices.get(0).get("bid").toString());
                        BigDecimal ask = new BigDecimal(prices.get(0).get("ask").toString());
                        return bid.add(ask).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Swissquote XAU/USD failed: {}", e.getMessage());
        }
        // Yahoo fallback: GC=F (COMEX gold futures, USD/oz)
        try {
            String raw = yahooClient.get()
                .uri("/v8/finance/chart/GC=F?interval=1d&range=1d")
                .retrieve().body(String.class);
            if (raw != null && !raw.trim().startsWith("<")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> body =
                    new ObjectMapper().readValue(raw, new TypeReference<Map<String, Object>>() {});
                BigDecimal price = extractRegularMarketPrice(body);
                if (price != null) return price;
            }
        } catch (Exception e) {
            log.warn("Yahoo GC=F XAU/USD failed: {}", e.getMessage());
        }
        return null;
    }

    /** Fetch USD/INR — tries open.er-api.com first, then frankfurter.app. */
    @SuppressWarnings("unchecked")
    private BigDecimal fetchUsdInr() {
        // Primary: open.er-api.com/v6/latest/USD
        try {
            Map<String, Object> resp = forexClient.get()
                .uri("/v6/latest/USD")
                .retrieve().body(Map.class);
            if (resp != null) {
                Map<String, Object> rates = (Map<String, Object>) resp.get("rates");
                if (rates != null && rates.containsKey("INR")) {
                    return new BigDecimal(rates.get("INR").toString());
                }
            }
        } catch (Exception e) {
            log.warn("open.er-api USD/INR failed: {}", e.getMessage());
        }
        // Fallback: frankfurter.app
        try {
            Map<String, Object> resp = frankfurterClient.get()
                .uri("/latest?from=USD&to=INR")
                .retrieve().body(Map.class);
            if (resp != null) {
                Map<String, Object> rates = (Map<String, Object>) resp.get("rates");
                if (rates != null && rates.containsKey("INR")) {
                    return new BigDecimal(rates.get("INR").toString());
                }
            }
        } catch (Exception e) {
            log.warn("Frankfurter USD/INR fallback failed: {}", e.getMessage());
        }
        return null;
    }

    // ── Mutual Funds ──────────────────────────────────────────────────────────

    @Override
    public List<Map<String, String>> searchMFSchemes(String query) {
        try {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> results = mfApiClient.get()
                .uri("/mf/search?q={q}", query)
                .retrieve().body(List.class);
            if (results == null) return List.of();
            List<Map<String, String>> out = new ArrayList<>();
            for (Map<String, Object> r : results) {
                Object code = r.get("schemeCode");
                String name = (String) r.get("schemeName");
                if (code != null && name != null)
                    out.add(Map.of("schemeCode", String.valueOf(code), "schemeName", name));
            }
            return out;
        } catch (Exception e) {
            log.warn("MF search failed for '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    @Override
    public MFNavData fetchMFNav(String schemeCode) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = mfApiClient.get()
                .uri("/mf/{code}/latest", schemeCode)
                .retrieve().body(Map.class);
            if (body == null) return null;
            @SuppressWarnings("unchecked")
            Map<String, String> meta = (Map<String, String>) body.get("meta");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> data = (List<Map<String, String>>) body.get("data");
            if (data == null || data.isEmpty()) return null;
            String navStr  = data.get(0).get("nav");
            String navDate = data.get(0).get("date");
            BigDecimal nav = navStr != null ? new BigDecimal(navStr) : null;
            return new MFNavData(nav, navDate,
                meta != null ? meta.get("scheme_name") : null,
                meta != null ? meta.get("fund_house")  : null);
        } catch (Exception e) {
            log.warn("MF NAV fetch failed for {}: {}", schemeCode, e.getMessage());
            return null;
        }
    }

    @Override
    public BigDecimal fetchStockPrice(String symbol) {
        String ticker = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? symbol : symbol + ".NS";
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = yahooClient.get()
                .uri("/v8/finance/chart/{ticker}?interval=1d&range=1d", ticker)
                .retrieve().body(Map.class);
            return extractRegularMarketPrice(body);
        } catch (Exception e) {
            log.warn("Stock price fetch failed for {}: {}", symbol, e.getMessage());
            return null;
        }
    }

    @Override
    public GoldPriceData fetchGoldPriceDataFresh() {
        goldCacheExpiry    = Instant.EPOCH;
        goldNextRetryAfter = Instant.EPOCH;
        return fetchGoldPriceData();
    }

    // ── Dividend history (Yahoo Finance query2 — no crumb, sequential calls) ──

    private static final int[] DIVIDEND_RETRY_DELAYS_MS = {2_000, 5_000};

    /**
     * Fetches dividend history from Yahoo Finance with up to 3 attempts.
     * Returns an empty map for a genuine no-dividends response.
     * Throws {@link RuntimeException} only when ALL attempts fail due to transient errors
     * (network, timeout, rate-limit) — callers that want to retry should catch this.
     */
    @Override
    @SuppressWarnings("unchecked")
    public Map<String, BigDecimal> fetchDividendHistory(String symbol, long fromEpochSeconds) {
        String ticker = symbol.endsWith(".NS") || symbol.endsWith(".BO") ? symbol : symbol + ".NS";
        long   now    = Instant.now().getEpochSecond();
        Exception lastError = null;
        for (int attempt = 0; attempt <= DIVIDEND_RETRY_DELAYS_MS.length; attempt++) {
            if (attempt > 0) {
                try { Thread.sleep(DIVIDEND_RETRY_DELAYS_MS[attempt - 1]); }
                catch (InterruptedException ie) { Thread.currentThread().interrupt(); return Map.of(); }
                log.info("Retrying dividend history fetch for {} (attempt {})", symbol, attempt + 1);
            }
            try {
                Map<String, Object> body = yahooClient.get()
                    .uri("/v8/finance/chart/{ticker}?events=div&period1={from}&period2={to}&interval=1d",
                        ticker, fromEpochSeconds, now)
                    .retrieve().body(Map.class);
                // Successful HTTP response — empty map means genuinely no dividends
                return body == null ? Map.of() : extractDividends(body);
            } catch (Exception e) {
                lastError = e;
                log.warn("Dividend history fetch failed for {} (attempt {}): {}", symbol, attempt + 1, e.getMessage());
            }
        }
        // All retries exhausted due to transient errors — throw so callers can retry at a higher level
        throw new RuntimeException("Dividend history unavailable for " + symbol + " after "
            + (DIVIDEND_RETRY_DELAYS_MS.length + 1) + " attempts: " + lastError.getMessage(), lastError);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private BigDecimal extractRegularMarketPrice(Map<String, Object> body) {
        if (body == null) return null;
        Map<String, Object> chart = (Map<String, Object>) body.get("chart");
        if (chart == null) return null;
        List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
        if (results == null || results.isEmpty()) return null;
        Map<String, Object> meta = (Map<String, Object>) results.get(0).get("meta");
        if (meta == null) return null;
        Object price = meta.get("regularMarketPrice");
        return price == null ? null : new BigDecimal(price.toString()).setScale(4, RoundingMode.HALF_UP);
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> extractDividends(Map<String, Object> body) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        try {
            Map<String, Object> chart = (Map<String, Object>) body.get("chart");
            List<Map<String, Object>> results = (List<Map<String, Object>>) chart.get("result");
            if (results == null || results.isEmpty()) return result;
            Map<String, Object> events = (Map<String, Object>) results.get(0).get("events");
            if (events == null) return result;
            Map<String, Map<String, Object>> dividends =
                (Map<String, Map<String, Object>>) events.get("dividends");
            if (dividends == null) return result;
            for (Map.Entry<String, Map<String, Object>> entry : dividends.entrySet()) {
                Map<String, Object> div = entry.getValue();
                Object amt  = div.get("amount");
                Object date = div.get("date");
                if (amt == null || date == null) continue;
                LocalDate exDate = Instant.ofEpochSecond(Long.parseLong(date.toString()))
                    .atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
                result.put(exDate.toString(),
                    new BigDecimal(amt.toString()).setScale(4, RoundingMode.HALF_UP));
            }
        } catch (Exception e) {
            log.warn("Dividend extraction error: {}", e.getMessage());
        }
        return result;
    }
}
