-- Latest mutual fund NAV per scheme code, refreshed by PriceRefreshScheduler.

CREATE TABLE mf_nav_cache (
    scheme_code   VARCHAR(20) PRIMARY KEY,
    scheme_name   VARCHAR(500),
    fund_house    VARCHAR(200),
    nav           NUMERIC(14,4),
    nav_date      DATE,
    last_updated  TIMESTAMPTZ
);
