-- Wallet accounts and account-to-account transfers

CREATE TABLE IF NOT EXISTS wallet_accounts (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type    VARCHAR(20)   NOT NULL,
    name            VARCHAR(100)  NOT NULL,
    bank_name       VARCHAR(100),
    opening_balance NUMERIC(14,2) DEFAULT 0 NOT NULL,
    account_number  VARCHAR(20),
    credit_limit    NUMERIC(15,2),
    statement_day   INTEGER,
    payment_due_day INTEGER,
    apr             NUMERIC(5,2),
    archived        BOOLEAN       DEFAULT false NOT NULL,
    created_at      TIMESTAMP     DEFAULT now() NOT NULL,
    updated_at      TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT wallet_accounts_account_type_check
        CHECK (account_type IN ('CASH_WALLET', 'BANK_ACCOUNT', 'EMERGENCY_FUND', 'CREDIT_CARD'))
);

-- Only one CASH_WALLET and one EMERGENCY_FUND allowed per user
CREATE UNIQUE INDEX IF NOT EXISTS wa_unique_cash     ON wallet_accounts (user_id) WHERE account_type = 'CASH_WALLET';
CREATE UNIQUE INDEX IF NOT EXISTS wa_unique_emergeny ON wallet_accounts (user_id) WHERE account_type = 'EMERGENCY_FUND';

CREATE TABLE IF NOT EXISTS account_transfers (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID          NOT NULL REFERENCES users(id),
    from_account_id UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    to_account_id   UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    amount          NUMERIC(14,2) NOT NULL,
    description     VARCHAR(255),
    transfer_date   DATE          NOT NULL,
    created_at      TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT account_transfers_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_transfers_from ON account_transfers (from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to   ON account_transfers (to_account_id);
