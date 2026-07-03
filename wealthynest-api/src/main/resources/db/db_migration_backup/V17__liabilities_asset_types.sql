-- Extend asset_type check to include new physical asset categories
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check;
ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check CHECK (
    asset_type IN (
        'BANK_ACCOUNT','CASH','STOCK','MUTUAL_FUND','BOND','GOLD','REAL_ESTATE','OTHER',
        'VEHICLE','GOLD_JEWELRY','BUSINESS_EQUITY','EPF_PPF','RECEIVABLES'
    )
);

-- Liabilities table
CREATE TABLE liabilities (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID          NOT NULL REFERENCES users(id),
    family_id          UUID          REFERENCES families(id),
    name               VARCHAR(100)  NOT NULL,
    liability_type     VARCHAR(30)   NOT NULL CHECK (liability_type IN (
                           'HOME_LOAN','CAR_LOAN','PERSONAL_LOAN','CREDIT_CARD',
                           'EDUCATION_LOAN','BUSINESS_LOAN','OTHER'
                       )),
    principal_amount   NUMERIC(16,2) NOT NULL DEFAULT 0,
    outstanding_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
    interest_rate      NUMERIC(5,2),
    lender_name        VARCHAR(100),
    emi_amount         NUMERIC(14,2),
    start_date         DATE,
    end_date           DATE,
    notes              TEXT,
    is_active          BOOLEAN       NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by         UUID,
    modified_by        UUID
);

CREATE INDEX idx_liabilities_user   ON liabilities(user_id);
CREATE INDEX idx_liabilities_family ON liabilities(family_id);
