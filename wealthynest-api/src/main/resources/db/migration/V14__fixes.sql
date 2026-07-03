-- Prevent duplicate system categories from future re-runs
ALTER TABLE categories
  ADD CONSTRAINT uq_categories_name_type_system
  UNIQUE (name, type, is_system)
  DEFERRABLE INITIALLY DEFERRED;

-- Expand recurring_income day_of_month to support 1-31 and 0 = Last Working Day
ALTER TABLE recurring_income
  DROP CONSTRAINT IF EXISTS recurring_income_day_of_month_check;

ALTER TABLE recurring_income
  ADD CONSTRAINT recurring_income_day_of_month_check
  CHECK (day_of_month BETWEEN 0 AND 31);
