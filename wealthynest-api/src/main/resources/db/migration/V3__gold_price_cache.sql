-- Single-row cache of the latest gold spot price, refreshed by PriceRefreshScheduler.

CREATE TABLE gold_price_cache (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    price_18k_per_gram  NUMERIC(10,2),
    price_22k_per_gram  NUMERIC(10,2),
    price_24k_per_gram  NUMERIC(10,2),
    spot_usd_per_oz     NUMERIC(10,4),
    usd_inr_rate        NUMERIC(8,4),
    last_updated        TIMESTAMPTZ
);
