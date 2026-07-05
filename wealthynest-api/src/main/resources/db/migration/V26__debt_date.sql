-- Add optional "debt given/taken date" to debt_records
ALTER TABLE debt_records ADD COLUMN IF NOT EXISTS debt_date DATE;
