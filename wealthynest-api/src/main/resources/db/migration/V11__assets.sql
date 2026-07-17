-- Tracked holdings (stocks, gold, real estate, etc.) — distinct from wallet_accounts (bank/cash)
-- and from investments (portfolio-tracked securities, which link back to one asset row each).

CREATE TABLE assets (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID          NOT NULL REFERENCES users(id),
    family_id       UUID          REFERENCES families(id),
    name            VARCHAR(100)  NOT NULL,
    asset_type      VARCHAR(30)   NOT NULL,
    current_value   NUMERIC(16,2) DEFAULT 0 NOT NULL,
    currency        VARCHAR(3)    DEFAULT 'INR' NOT NULL,
    institution     VARCHAR(100),
    account_number  VARCHAR(50),
    notes           TEXT,
    is_active       BOOLEAN       DEFAULT true NOT NULL,
    as_of_date      DATE          DEFAULT CURRENT_DATE NOT NULL,
    created_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by      UUID,
    modified_by     UUID,
    CONSTRAINT assets_asset_type_check CHECK (asset_type IN (
        'BANK_ACCOUNT', 'CASH', 'STOCK', 'MUTUAL_FUND', 'BOND', 'GOLD', 'REAL_ESTATE', 'OTHER',
        'VEHICLE', 'GOLD_JEWELRY', 'BUSINESS_EQUITY', 'EPF_PPF', 'RECEIVABLES'))
);

CREATE INDEX idx_assets_user   ON assets (user_id);
CREATE INDEX idx_assets_family ON assets (family_id);
