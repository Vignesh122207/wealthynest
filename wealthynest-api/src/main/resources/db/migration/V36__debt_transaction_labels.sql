-- Debt-linked expense/income rows previously carried no structured way to identify the
-- counterparty or direction (Lent/Borrowed/Repaid) — only a free-text description that gets
-- overwritten if the user supplies their own note, silently dropping the contact's name.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS debt_contact_name VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS debt_label        VARCHAR(20);

ALTER TABLE income_entries ADD COLUMN IF NOT EXISTS debt_contact_name VARCHAR(255);
ALTER TABLE income_entries ADD COLUMN IF NOT EXISTS debt_label        VARCHAR(20);
