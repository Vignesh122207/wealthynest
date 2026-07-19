-- Portfolio-tracked securities (stocks, MF, bonds, FD, gold, etc.) — each row links to exactly
-- one Asset (asset_id) for net-worth rollup purposes. debit_account_id/debit_expense_id/
-- debit_transfer_id record which wallet-account write funded the purchase, kept as plain UUID
-- columns (no FK) like other cross-domain references in this schema, to avoid a circular
-- dependency between investments and the expense/transfer tables that fund them.

CREATE TABLE investments (
    id                     UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                UUID          NOT NULL REFERENCES users(id),
    asset_id               UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    linked_account_id      UUID          REFERENCES wallet_accounts(id),
    investment_type        VARCHAR(30)   NOT NULL,
    symbol                 VARCHAR(30),
    exchange               VARCHAR(10)   DEFAULT 'NSE',
    scheme_code            VARCHAR(20),
    company_name           VARCHAR(200),
    bank_name              VARCHAR(100),
    units                  NUMERIC(14,4),
    avg_buy_price          NUMERIC(14,4),
    current_price          NUMERIC(14,4),
    invested_amount        NUMERIC(16,2) NOT NULL,
    current_value          NUMERIC(16,2) NOT NULL,
    purchase_date          DATE,
    maturity_date          DATE,
    face_value             NUMERIC(14,4),
    coupon_rate             NUMERIC(5,2),
    coupon_frequency        VARCHAR(20),
    coupon_credit_day       INTEGER,
    compounding_frequency   VARCHAR(20),
    quantity_grams          NUMERIC(10,4),
    gold_karat               INTEGER       DEFAULT 22,
    sip_amount               NUMERIC(14,2),
    sip_day                  INTEGER,
    tds_rate                 NUMERIC(5,2)  DEFAULT 0,
    brokerage                 NUMERIC(14,2) DEFAULT 0,
    debit_account_id          UUID,
    debit_expense_id          UUID,
    debit_transfer_id         UUID,
    notes                     TEXT,
    is_active                 BOOLEAN       DEFAULT true NOT NULL,
    created_at                TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at                TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by                UUID,
    modified_by               UUID,
    CONSTRAINT investments_investment_type_check CHECK (investment_type IN (
        'STOCK', 'MUTUAL_FUND', 'BOND', 'FD', 'PPF', 'NPS',
        'GOLD_ETF', 'REIT', 'OTHER', 'GOLD')),
    CONSTRAINT investments_sip_day_check CHECK (sip_day BETWEEN 1 AND 31)
);

CREATE INDEX idx_investments_user            ON investments (user_id);
CREATE INDEX idx_investments_asset           ON investments (asset_id);
CREATE INDEX idx_investments_linked_account  ON investments (linked_account_id);
CREATE INDEX idx_investments_symbol_active   ON investments (symbol, is_active) WHERE is_active = true;
