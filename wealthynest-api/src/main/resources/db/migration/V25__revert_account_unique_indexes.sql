-- Revert V24: restore the original strict unique indexes.
-- These enforce one CASH_WALLET and one EMERGENCY_FUND per user ever (including archived).
-- The service layer handles the user-facing message when an archived one exists.

DROP INDEX IF EXISTS wa_unique_cash;
DROP INDEX IF EXISTS wa_unique_emergency;

CREATE UNIQUE INDEX wa_unique_cash
    ON wallet_accounts (user_id)
    WHERE account_type = 'CASH_WALLET';

CREATE UNIQUE INDEX wa_unique_emergeny
    ON wallet_accounts (user_id)
    WHERE account_type = 'EMERGENCY_FUND';
