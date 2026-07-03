-- Investments (stocks, MF, bonds, FD, gold, etc.) with SIP transactions and income logs

CREATE TABLE IF NOT EXISTS investments (
    id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              UUID          NOT NULL REFERENCES users(id),
    asset_id             UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    linked_account_id    UUID          REFERENCES wallet_accounts(id),
    investment_type      VARCHAR(30)   NOT NULL,
    symbol               VARCHAR(30),
    exchange             VARCHAR(10)   DEFAULT 'NSE',
    scheme_code          VARCHAR(20),
    company_name         VARCHAR(200),
    bank_name            VARCHAR(100),
    units                NUMERIC(14,4),
    avg_buy_price        NUMERIC(14,4),
    current_price        NUMERIC(14,4),
    invested_amount      NUMERIC(16,2) NOT NULL,
    current_value        NUMERIC(16,2) NOT NULL,
    purchase_date        DATE,
    maturity_date        DATE,
    coupon_rate          NUMERIC(5,2),
    coupon_frequency     VARCHAR(20),
    coupon_credit_day    INTEGER,
    compounding_frequency VARCHAR(20),
    quantity_grams       NUMERIC(10,4),
    gold_karat           INTEGER       DEFAULT 22,
    sip_amount           NUMERIC(14,2),
    sip_day              INTEGER,
    notes                TEXT,
    is_active            BOOLEAN       DEFAULT true NOT NULL,
    created_at           TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at           TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by           UUID,
    modified_by          UUID,
    CONSTRAINT investments_investment_type_check CHECK (investment_type IN (
        'STOCK', 'MUTUAL_FUND', 'BOND', 'FD', 'PPF', 'NPS',
        'GOLD_ETF', 'REIT', 'OTHER', 'GOLD')),
    CONSTRAINT investments_sip_day_check CHECK (sip_day BETWEEN 1 AND 31)
);

CREATE INDEX IF NOT EXISTS idx_investments_user  ON investments (user_id);
CREATE INDEX IF NOT EXISTS idx_investments_asset ON investments (asset_id);

CREATE SEQUENCE IF NOT EXISTS sip_transactions_id_seq;

CREATE TABLE IF NOT EXISTS sip_transactions (
    id               BIGINT        DEFAULT nextval('sip_transactions_id_seq') PRIMARY KEY,
    investment_id    UUID          NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    transaction_date DATE          NOT NULL,
    amount           NUMERIC(18,2) NOT NULL,
    units            NUMERIC(18,4),
    nav              NUMERIC(18,4),
    transaction_type VARCHAR(20)   DEFAULT 'BUY' NOT NULL,
    notes            VARCHAR(500),
    created_at       TIMESTAMPTZ   DEFAULT now() NOT NULL
);

ALTER SEQUENCE sip_transactions_id_seq OWNED BY sip_transactions.id;

CREATE INDEX IF NOT EXISTS idx_sip_investment ON sip_transactions (investment_id);
CREATE INDEX IF NOT EXISTS idx_sip_date       ON sip_transactions (transaction_date DESC);

CREATE TABLE IF NOT EXISTS dividend_income (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    investment_id   UUID          NOT NULL REFERENCES investments(id),
    user_id         UUID          NOT NULL REFERENCES users(id),
    amount          NUMERIC(14,2) NOT NULL,
    dividend_date   DATE          NOT NULL,
    tax_deducted    NUMERIC(14,2) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by      UUID,
    modified_by     UUID,
    CONSTRAINT dividend_income_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_dividends_user ON dividend_income (user_id, dividend_date DESC);

CREATE TABLE IF NOT EXISTS bond_interest (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    investment_id   UUID          NOT NULL REFERENCES investments(id),
    user_id         UUID          NOT NULL REFERENCES users(id),
    amount          NUMERIC(14,2) NOT NULL,
    interest_date   DATE          NOT NULL,
    tax_deducted    NUMERIC(14,2) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by      UUID,
    modified_by     UUID,
    CONSTRAINT bond_interest_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_bond_interest_user ON bond_interest (user_id, interest_date DESC);

CREATE TABLE IF NOT EXISTS investment_income_log (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    investment_id   UUID          NOT NULL REFERENCES investments(id),
    user_id         UUID          NOT NULL REFERENCES users(id),
    income_entry_id UUID          REFERENCES income_entries(id),
    income_type     VARCHAR(20)   NOT NULL,
    event_date      DATE          NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    created_at      TIMESTAMPTZ   DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_income_log   ON investment_income_log (investment_id, income_type, event_date);
CREATE INDEX        IF NOT EXISTS idx_inv_income_log_user ON investment_income_log (user_id);
