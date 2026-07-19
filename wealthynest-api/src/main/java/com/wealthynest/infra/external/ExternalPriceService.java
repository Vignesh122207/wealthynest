package com.wealthynest.infra.external;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface ExternalPriceService {
    /** Returns 22K gold price per gram in INR */
    BigDecimal fetchGoldPrice22k();

    /** Returns raw gold prices: 22k, 24k, spot_usd, usd_inr */
    GoldPriceData fetchGoldPriceData();

    /**
     * Pulls mfapi.in's full scheme list (all AMCs, all schemes — tens of thousands of rows) in one
     * call and replaces the local mf_master table with it. Returns the number of schemes synced.
     * Search itself queries mf_master, not mfapi.in directly — see InvestmentServiceImpl.searchMF().
     */
    int syncMfMaster();

    /** Returns current NAV for scheme code */
    MFNavData fetchMFNav(String schemeCode);

    /** Returns dividend history for a NSE symbol since fromEpoch (UNIX seconds). Map of exDate→perShare */
    Map<String, BigDecimal> fetchDividendHistory(String symbol, long fromEpochSeconds);

    /** Returns current market price for an NSE stock symbol (appends .NS if needed). Null on failure. */
    BigDecimal fetchStockPrice(String symbol);

    /**
     * Search Yahoo Finance for BSE-listed stocks matching query.
     * Returns results with exchange="BSE" and symbol without .BO suffix.
     * Only called by searchStocks to supplement the local NSE master DB.
     */
    List<com.wealthynest.domain.investment.dto.response.InvestmentSearchResult> searchBSEStocks(String query);

    /** Like fetchGoldPriceData() but bypasses the in-memory TTL cache, forcing a fresh API call. */
    GoldPriceData fetchGoldPriceDataFresh();

    record GoldPriceData(BigDecimal price22k, BigDecimal price24k, BigDecimal price18k, BigDecimal spotUsd, BigDecimal usdInr) {
        /** Price per gram for the requested karat (18, 22, or 24). */
        public BigDecimal priceForKarat(int karat) {
            return switch (karat) {
                case 24 -> price24k;
                case 18 -> price18k;
                default -> price22k;
            };
        }
    }
    record MFNavData(BigDecimal nav, String navDate, String schemeName, String fundHouse) {}
}
