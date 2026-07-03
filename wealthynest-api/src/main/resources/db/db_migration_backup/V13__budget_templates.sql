-- Budgets become permanent templates; period is no longer stored on the budget.
-- Spending is computed dynamically against the requested view period.

-- Drop period-specific unique indexes from V8/V9
DROP INDEX IF EXISTS budgets_unique_user_monthly;
DROP INDEX IF EXISTS budgets_unique_family_monthly;
DROP INDEX IF EXISTS budgets_unique_user_yearly;
DROP INDEX IF EXISTS budgets_unique_family_yearly;

-- Drop the period_month CHECK constraint (0 is now valid)
DO $$
DECLARE cname TEXT;
BEGIN
    SELECT conname INTO cname FROM pg_constraint
    WHERE conrelid = 'budgets'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%period_month%';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE budgets DROP CONSTRAINT %I', cname);
    END IF;
END $$;

-- Set columns to 0 for all existing rows (sentinel: "no period")
ALTER TABLE budgets ALTER COLUMN period_month SET DEFAULT 0;
ALTER TABLE budgets ALTER COLUMN period_year  SET DEFAULT 0;
UPDATE budgets SET period_month = 0, period_year = 0;

-- New constraint: one budget definition per user + category + type
CREATE UNIQUE INDEX budgets_unique_user_type
    ON budgets(user_id, category_id, budget_type)
    WHERE user_id IS NOT NULL AND family_id IS NULL;

CREATE UNIQUE INDEX budgets_unique_family_type
    ON budgets(family_id, category_id, budget_type)
    WHERE family_id IS NOT NULL;
