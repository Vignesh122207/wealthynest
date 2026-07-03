package com.wealthynest.infra.external;

import java.time.LocalDate;

public interface StockDataService {
    /** Download NSE EQUITY_L.csv and upsert all symbols */
    int refreshNSEMaster();
    /** Download NSE bhavcopy ZIP for given date, update stock_price_cache + investments */
    int updateEODPrices(LocalDate tradeDate);
    /** Download full NSE corporate actions list and upsert dividend events (weekly use) */
    int refreshCorporateActions();
    /** Download daily NSE CA file for specific date (CA_{ddMMYYYY}.csv) and upsert dividends */
    int refreshDailyCorporateActions(LocalDate date);
}
