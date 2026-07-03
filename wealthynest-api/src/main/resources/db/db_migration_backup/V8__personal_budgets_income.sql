-- Allow budgets without a family (personal budgets)
ALTER TABLE budgets ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE budgets ALTER COLUMN family_id DROP NOT NULL;

-- Drop existing unique constraint (was on family_id only)
ALTER TABLE budgets DROP CONSTRAINT budgets_family_id_category_id_period_month_period_year_key;

-- Partial unique indexes: one path for family budgets, one for personal
CREATE UNIQUE INDEX budgets_unique_family
  ON budgets(family_id, category_id, period_month, period_year)
  WHERE family_id IS NOT NULL;

CREATE UNIQUE INDEX budgets_unique_user
  ON budgets(user_id, category_id, period_month, period_year)
  WHERE user_id IS NOT NULL AND family_id IS NULL;

CREATE INDEX idx_budgets_user_period ON budgets(user_id, period_year, period_month);

-- Income entries table
CREATE TABLE income_entries (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source       VARCHAR(50)  NOT NULL CHECK (source IN
                     ('SALARY','FREELANCE','BUSINESS','RENTAL','BONUS','INTEREST','DIVIDEND','OTHER')),
    amount       NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description  VARCHAR(255),
    income_date  DATE         NOT NULL,
    period_month INTEGER      NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year  INTEGER      NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_user_date   ON income_entries(user_id, income_date DESC);
CREATE INDEX idx_income_user_period ON income_entries(user_id, period_year, period_month);
