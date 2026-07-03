-- Remove all shadow expense/income rows that were auto-created by the debt tracker.
-- Account balance is now calculated directly from debt_records (amount_remaining),
-- so these hidden rows are no longer needed and must be purged to avoid double-counting.
DELETE FROM expenses       WHERE is_debt = true;
DELETE FROM income_entries WHERE is_debt = true;
