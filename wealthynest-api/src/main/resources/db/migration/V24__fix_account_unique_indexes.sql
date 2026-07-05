-- Fix singleton unique indexes to allow archiving + re-creating the same account type.
-- Old indexes blocked ANY second row of the same type, even if the first is archived.
-- New partial indexes enforce uniqueness only among non-archived accounts.

DROP INDEX IF EXISTS wa_unique_cash;
DROP INDEX IF EXISTS wa_unique_emergeny;

CREATE UNIQUE INDEX wa_unique_cash
    ON wallet_accounts (user_id)
    WHERE account_type = 'CASH_WALLET'
      AND archived = false;

CREATE UNIQUE INDEX wa_unique_emergency
    ON wallet_accounts (user_id)
    WHERE account_type = 'EMERGENCY_FUND'
      AND archived = false;
