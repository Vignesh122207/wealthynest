CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID          NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    category_id     UUID          NOT NULL REFERENCES categories(id),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    period_month    INTEGER      NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year     INTEGER      NOT NULL,
    alert_threshold NUMERIC(5,2)  DEFAULT 80.00,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by      UUID,
    modified_by     UUID,
    UNIQUE (family_id, category_id, period_month, period_year)
);

CREATE INDEX idx_budgets_family_period ON budgets(family_id, period_year, period_month);
