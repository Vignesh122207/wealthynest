-- Loan & Investment account types.
-- Loans are liability accounts: opening_balance = outstanding at creation, payments (transfers in)
-- reduce it. EMI autopay is configured on the account itself and executed by the LOAN_EMI job,
-- splitting each EMI into interest (expense) and principal (transfer). Investment accounts are
-- broker-cash asset accounts (bank_name doubles as lender / broker name).
ALTER TABLE wallet_accounts
  ADD COLUMN IF NOT EXISTS loan_type          VARCHAR(20),
  ADD COLUMN IF NOT EXISTS principal_amount   NUMERIC(16,2),
  ADD COLUMN IF NOT EXISTS emi_amount         NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS emi_day            INTEGER,
  ADD COLUMN IF NOT EXISTS autopay_account_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loan_end_date      DATE,
  ADD COLUMN IF NOT EXISTS last_emi_yyyymm    INTEGER;

-- System category for the interest portion of EMI payments (fixed id, referenced from code).
-- WHERE NOT EXISTS instead of ON CONFLICT: the categories unique constraint is DEFERRABLE,
-- which Postgres cannot use as an ON CONFLICT arbiter.
INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT 'a0a41e57-0000-0000-0000-000000000001', NULL, 'Loan Interest', 'percent', '#f43f5e', 'EXPENSE', true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Loan Interest' AND type = 'EXPENSE' AND is_system = true
);

-- EMI autopay job — daily check at 05:30 IST, pays loans whose EMI day is today
INSERT INTO job_schedule_config (job_name, display_name, cron_expression)
VALUES ('LOAN_EMI', 'Loan EMI Auto-Pay', '0 30 5 * * *')
ON CONFLICT (job_name) DO NOTHING;
