CREATE TABLE dividend_income (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID          NOT NULL REFERENCES investments(id),
    user_id       UUID          NOT NULL REFERENCES users(id),
    amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    dividend_date DATE          NOT NULL,
    tax_deducted  NUMERIC(14,2) DEFAULT 0,
    notes         TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by    UUID,
    modified_by   UUID
);

CREATE TABLE bond_interest (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID          NOT NULL REFERENCES investments(id),
    user_id       UUID          NOT NULL REFERENCES users(id),
    amount        NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    interest_date DATE          NOT NULL,
    tax_deducted  NUMERIC(14,2) DEFAULT 0,
    notes         TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by    UUID,
    modified_by   UUID
);

CREATE INDEX idx_dividends_user     ON dividend_income(user_id, dividend_date DESC);
CREATE INDEX idx_bond_interest_user ON bond_interest(user_id, interest_date DESC);
