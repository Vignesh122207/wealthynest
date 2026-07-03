-- System category for debt-linked transactions
INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT 'd1eb7000-0000-0000-0000-000000000001', NULL, 'Debt & Loans', 'handshake', '#6366f1', 'EXPENSE', true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Debt & Loans' AND type = 'EXPENSE' AND is_system = true
);

-- Link debt record to an account (optional) and track generated transactions
ALTER TABLE debt_records
  ADD COLUMN IF NOT EXISTS account_id         UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_expense_id  UUID,
  ADD COLUMN IF NOT EXISTS linked_income_id   UUID;
