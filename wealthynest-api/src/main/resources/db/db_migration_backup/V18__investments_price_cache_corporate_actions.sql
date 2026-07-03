-- ── Extend investments table ──────────────────────────────────────────────────
ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS purchase_date          DATE,
    ADD COLUMN IF NOT EXISTS exchange               VARCHAR(10)    DEFAULT 'NSE',
    ADD COLUMN IF NOT EXISTS scheme_code            VARCHAR(20),
    ADD COLUMN IF NOT EXISTS company_name           VARCHAR(200),
    ADD COLUMN IF NOT EXISTS coupon_rate            NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS coupon_frequency       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS maturity_date          DATE,
    ADD COLUMN IF NOT EXISTS bank_name              VARCHAR(100),
    ADD COLUMN IF NOT EXISTS compounding_frequency  VARCHAR(20),
    ADD COLUMN IF NOT EXISTS quantity_grams         NUMERIC(10,4),
    ADD COLUMN IF NOT EXISTS linked_account_id      UUID REFERENCES wallet_accounts(id),
    ADD COLUMN IF NOT EXISTS notes                  TEXT,
    ADD COLUMN IF NOT EXISTS is_active              BOOLEAN        NOT NULL DEFAULT true;

-- Allow GOLD type in investment_type check
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_investment_type_check;
ALTER TABLE investments ADD CONSTRAINT investments_investment_type_check
    CHECK (investment_type IN (
        'STOCK','MUTUAL_FUND','BOND','FD','PPF','NPS','GOLD_ETF','REIT','OTHER','GOLD'
    ));

-- ── Stock price cache ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_price_cache (
    symbol          VARCHAR(30) PRIMARY KEY,
    exchange        VARCHAR(10)   NOT NULL DEFAULT 'NSE',
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

-- ── Gold price cache ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gold_price_cache (
    id                  INT PRIMARY KEY DEFAULT 1,
    price_22k_per_gram  NUMERIC(10,2),
    price_24k_per_gram  NUMERIC(10,2),
    spot_usd_per_oz     NUMERIC(10,4),
    usd_inr_rate        NUMERIC(8,4),
    last_updated        TIMESTAMPTZ
);
INSERT INTO gold_price_cache(id) VALUES(1) ON CONFLICT DO NOTHING;

-- ── MF NAV cache ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mf_nav_cache (
    scheme_code   VARCHAR(20) PRIMARY KEY,
    scheme_name   VARCHAR(500),
    fund_house    VARCHAR(200),
    nav           NUMERIC(14,4),
    nav_date      DATE,
    last_updated  TIMESTAMPTZ
);

-- ── NSE corporate actions (dividend tracking) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS nse_corporate_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol              VARCHAR(30)  NOT NULL,
    action_type         VARCHAR(20)  NOT NULL DEFAULT 'DIVIDEND',
    ex_date             DATE         NOT NULL,
    record_date         DATE,
    dividend_per_share  NUMERIC(10,4),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_corp_action ON nse_corporate_actions(symbol, action_type, ex_date);
CREATE INDEX IF NOT EXISTS idx_corp_actions_symbol ON nse_corporate_actions(symbol, ex_date DESC);

-- ── Auto-income tracking for dividend/bond/FD ─────────────────────────────────
CREATE TABLE IF NOT EXISTS investment_income_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id   UUID         NOT NULL REFERENCES investments(id),
    user_id         UUID         NOT NULL REFERENCES users(id),
    income_entry_id UUID         REFERENCES income_entries(id),
    income_type     VARCHAR(20)  NOT NULL,   -- DIVIDEND, BOND_COUPON, FD_INTEREST, FD_MATURITY
    event_date      DATE         NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_income_log ON investment_income_log(investment_id, income_type, event_date);
CREATE INDEX IF NOT EXISTS idx_inv_income_log_user ON investment_income_log(user_id);
