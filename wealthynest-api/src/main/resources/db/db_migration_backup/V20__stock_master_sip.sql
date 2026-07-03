-- ── Stock master (NSE + BSE equity list, updated weekly) ─────────────────────
CREATE TABLE stock_master (
    id           BIGSERIAL    PRIMARY KEY,
    symbol       VARCHAR(50)  NOT NULL,
    company_name VARCHAR(300) NOT NULL,
    exchange     VARCHAR(10)  NOT NULL DEFAULT 'NSE',
    isin         VARCHAR(20),
    series       VARCHAR(10),
    sector       VARCHAR(100),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_stock_master UNIQUE(symbol, exchange)
);
CREATE INDEX idx_sm_symbol ON stock_master(symbol);
CREATE INDEX idx_sm_company ON stock_master(lower(company_name));
CREATE INDEX idx_sm_isin ON stock_master(isin) WHERE isin IS NOT NULL;

-- ── SIP transactions (per MF investment) ─────────────────────────────────────
CREATE TABLE sip_transactions (
    id               BIGSERIAL    PRIMARY KEY,
    investment_id    UUID         NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    transaction_date DATE         NOT NULL,
    amount           NUMERIC(18,2) NOT NULL,
    units            NUMERIC(18,4),
    nav              NUMERIC(18,4),
    transaction_type VARCHAR(20)  NOT NULL DEFAULT 'BUY',
    notes            VARCHAR(500),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sip_investment ON sip_transactions(investment_id);
CREATE INDEX idx_sip_date ON sip_transactions(transaction_date DESC);
