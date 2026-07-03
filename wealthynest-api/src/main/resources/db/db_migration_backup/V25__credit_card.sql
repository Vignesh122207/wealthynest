-- Add CREDIT_CARD account type and credit-card-specific columns

ALTER TABLE wallet_accounts
    ADD COLUMN credit_limit     NUMERIC(15, 2),
    ADD COLUMN statement_day    SMALLINT,       -- day of month statement closes (1-28)
    ADD COLUMN payment_due_day  SMALLINT,       -- day of month payment is due (1-28)
    ADD COLUMN apr              NUMERIC(5, 2);  -- annual interest rate (optional, informational)

-- Widen the account_type check constraint
ALTER TABLE wallet_accounts DROP CONSTRAINT IF EXISTS wallet_accounts_account_type_check;
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_account_type_check
    CHECK (account_type IN ('CASH_WALLET','BANK_ACCOUNT','EMERGENCY_FUND','CREDIT_CARD'));
