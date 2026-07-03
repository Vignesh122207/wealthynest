-- Budget type: MONTHLY (default) or YEARLY
ALTER TABLE budgets ADD COLUMN budget_type VARCHAR(10) NOT NULL DEFAULT 'MONTHLY'
    CHECK (budget_type IN ('MONTHLY', 'YEARLY'));

-- For YEARLY budgets, period_month = 0 (sentinel - year has no specific month)
-- Re-create partial unique index to include budget_type for MONTHLY
DROP INDEX IF EXISTS budgets_unique_user;
DROP INDEX IF EXISTS budgets_unique_family;

CREATE UNIQUE INDEX budgets_unique_user_monthly
    ON budgets(user_id, category_id, period_year, period_month)
    WHERE user_id IS NOT NULL AND family_id IS NULL AND budget_type = 'MONTHLY';

CREATE UNIQUE INDEX budgets_unique_family_monthly
    ON budgets(family_id, category_id, period_year, period_month)
    WHERE family_id IS NOT NULL AND budget_type = 'MONTHLY';

CREATE UNIQUE INDEX budgets_unique_user_yearly
    ON budgets(user_id, category_id, period_year)
    WHERE user_id IS NOT NULL AND family_id IS NULL AND budget_type = 'YEARLY';

CREATE UNIQUE INDEX budgets_unique_family_yearly
    ON budgets(family_id, category_id, period_year)
    WHERE family_id IS NOT NULL AND budget_type = 'YEARLY';

-- Link expenses to a specific budget (optional)
ALTER TABLE expenses ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL;
CREATE INDEX idx_expenses_budget ON expenses(budget_id);
