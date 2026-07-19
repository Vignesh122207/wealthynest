-- Latest price snapshot per stock symbol, refreshed from NSE/BSE bhavcopy loads and used to
-- bulk-sync investments.current_value (see InvestmentRepository.syncStockCurrentValuesFromCache).

CREATE TABLE stock_price_cache (
    symbol          VARCHAR(30) PRIMARY KEY,
    exchange        VARCHAR(10) DEFAULT 'NSE' NOT NULL,
    company_name    VARCHAR(200),
    current_price   NUMERIC(14,4),
    previous_close  NUMERIC(14,4),
    day_change      NUMERIC(14,4),
    day_change_pct  NUMERIC(8,4),
    week52_high     NUMERIC(14,4),
    week52_low      NUMERIC(14,4),
    market_cap      NUMERIC(20,2),
    last_updated    TIMESTAMPTZ
);
