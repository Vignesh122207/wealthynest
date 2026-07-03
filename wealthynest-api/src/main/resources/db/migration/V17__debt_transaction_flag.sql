-- Mark expense/income entries that were auto-created by the debt tracker
-- These affect account balance but are hidden from the Transactions page
ALTER TABLE expenses       ADD COLUMN IF NOT EXISTS is_debt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE income_entries ADD COLUMN IF NOT EXISTS is_debt BOOLEAN NOT NULL DEFAULT FALSE;
