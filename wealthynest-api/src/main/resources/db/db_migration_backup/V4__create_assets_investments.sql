CREATE TABLE assets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID          NOT NULL REFERENCES users(id),
    family_id      UUID          REFERENCES families(id),
    name           VARCHAR(100)  NOT NULL,
    asset_type     VARCHAR(30)   NOT NULL CHECK (asset_type IN
                       ('BANK_ACCOUNT','CASH','STOCK','MUTUAL_FUND','BOND','GOLD','REAL_ESTATE','OTHER')),
    current_value  NUMERIC(16,2) NOT NULL DEFAULT 0,
    currency       VARCHAR(3)    NOT NULL DEFAULT 'INR',
    institution    VARCHAR(100),
    account_number VARCHAR(50),
    notes          TEXT,
    is_active      BOOLEAN       NOT NULL DEFAULT true,
    as_of_date     DATE          NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by     UUID,
    modified_by    UUID
);

CREATE TABLE investments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id        UUID          NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id         UUID          NOT NULL REFERENCES users(id),
    investment_type VARCHAR(30)   NOT NULL CHECK (investment_type IN
                        ('STOCK','MUTUAL_FUND','BOND','FD','PPF','NPS','GOLD_ETF','REIT','OTHER')),
    symbol          VARCHAR(30),
    units           NUMERIC(14,4),
    avg_buy_price   NUMERIC(14,4),
    current_price   NUMERIC(14,4),
    invested_amount NUMERIC(16,2) NOT NULL,
    current_value   NUMERIC(16,2) NOT NULL,
    sip_amount      NUMERIC(14,2),
    sip_day         INTEGER CHECK (sip_day BETWEEN 1 AND 31),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by      UUID,
    modified_by     UUID
);

CREATE INDEX idx_assets_user      ON assets(user_id);
CREATE INDEX idx_assets_family    ON assets(family_id);
CREATE INDEX idx_investments_user ON investments(user_id);
CREATE INDEX idx_investments_asset ON investments(asset_id);
