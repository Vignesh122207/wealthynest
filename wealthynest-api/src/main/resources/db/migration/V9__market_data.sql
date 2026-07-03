-- Market data caches: stocks, gold, mutual funds, NSE corporate actions, stock master

CREATE SEQUENCE IF NOT EXISTS stock_master_id_seq;

CREATE TABLE IF NOT EXISTS stock_master (
    id           BIGINT        DEFAULT nextval('stock_master_id_seq') PRIMARY KEY,
    symbol       VARCHAR(50)   NOT NULL,
    company_name VARCHAR(300)  NOT NULL,
    exchange     VARCHAR(10)   DEFAULT 'NSE' NOT NULL,
    isin         VARCHAR(20),
    series       VARCHAR(10),
    sector       VARCHAR(100),
    is_active    BOOLEAN       DEFAULT true NOT NULL,
    created_at   TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at   TIMESTAMPTZ   DEFAULT now() NOT NULL,
    CONSTRAINT uq_stock_master UNIQUE (symbol, exchange)
);

ALTER SEQUENCE stock_master_id_seq OWNED BY stock_master.id;

CREATE INDEX IF NOT EXISTS idx_sm_symbol  ON stock_master (symbol);
CREATE INDEX IF NOT EXISTS idx_sm_company ON stock_master (lower(company_name));
CREATE INDEX IF NOT EXISTS idx_sm_isin    ON stock_master (isin) WHERE isin IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_price_cache (
    symbol          VARCHAR(30)   PRIMARY KEY,
    exchange        VARCHAR(10)   DEFAULT 'NSE' NOT NULL,
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

CREATE TABLE IF NOT EXISTS gold_price_cache (
    id                  INTEGER DEFAULT 1 PRIMARY KEY,
    price_22k_per_gram  NUMERIC(10,2),
    price_24k_per_gram  NUMERIC(10,2),
    price_18k_per_gram  NUMERIC(10,2),
    spot_usd_per_oz     NUMERIC(10,4),
    usd_inr_rate        NUMERIC(8,4),
    last_updated        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mf_nav_cache (
    scheme_code  VARCHAR(20)  PRIMARY KEY,
    scheme_name  VARCHAR(500),
    fund_house   VARCHAR(200),
    nav          NUMERIC(14,4),
    nav_date     DATE,
    last_updated TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS nse_corporate_actions (
    id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol              VARCHAR(30)   NOT NULL,
    action_type         VARCHAR(20)   DEFAULT 'DIVIDEND' NOT NULL,
    ex_date             DATE          NOT NULL,
    record_date         DATE,
    dividend_per_share  NUMERIC(10,4),
    created_at          TIMESTAMPTZ   DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_corp_action       ON nse_corporate_actions (symbol, action_type, ex_date);
CREATE INDEX        IF NOT EXISTS idx_corp_actions_symbol ON nse_corporate_actions (symbol, ex_date DESC);
