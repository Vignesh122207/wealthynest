-- Budgets — template-based (period_month/period_year = 0 means reusable template)

CREATE TABLE IF NOT EXISTS budgets (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID          REFERENCES users(id)    ON DELETE CASCADE,
    family_id       UUID          REFERENCES families(id) ON DELETE CASCADE,
    category_id     UUID          NOT NULL REFERENCES categories(id),
    budget_type     VARCHAR(10)   DEFAULT 'MONTHLY' NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    period_month    INTEGER       DEFAULT 0 NOT NULL,
    period_year     INTEGER       DEFAULT 0 NOT NULL,
    alert_threshold NUMERIC(5,2)  DEFAULT 80.00,
    created_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by      UUID,
    modified_by     UUID,
    CONSTRAINT budgets_amount_check     CHECK (amount > 0),
    CONSTRAINT budgets_budget_type_check CHECK (budget_type IN ('MONTHLY', 'YEARLY'))
);

-- One budget template per user/family per category per type
CREATE UNIQUE INDEX IF NOT EXISTS budgets_unique_user_type
    ON budgets (user_id, category_id, budget_type) WHERE user_id IS NOT NULL AND family_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_unique_family_type
    ON budgets (family_id, category_id, budget_type) WHERE family_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_user_period   ON budgets (user_id,   period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_budgets_family_period ON budgets (family_id, period_year, period_month);
