CREATE TABLE wallet_accounts (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type    VARCHAR(20)  NOT NULL CHECK (account_type IN ('CASH_WALLET','BANK_ACCOUNT','EMERGENCY_FUND')),
    name            VARCHAR(100) NOT NULL,
    bank_name       VARCHAR(100),
    opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Only one Cash Wallet and one Emergency Fund per user
CREATE UNIQUE INDEX wa_unique_cash     ON wallet_accounts(user_id) WHERE account_type = 'CASH_WALLET';
CREATE UNIQUE INDEX wa_unique_emergeny ON wallet_accounts(user_id) WHERE account_type = 'EMERGENCY_FUND';

CREATE TABLE account_transfers (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id),
    from_account_id UUID         NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    to_account_id   UUID         NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    amount          DECIMAL(14,2) NOT NULL CHECK (amount > 0),
    description     VARCHAR(255),
    transfer_date   DATE         NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transfers_from ON account_transfers(from_account_id);
CREATE INDEX idx_transfers_to   ON account_transfers(to_account_id);

-- Link income and expenses to a wallet account
ALTER TABLE income_entries ADD COLUMN account_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL;
ALTER TABLE expenses        ADD COLUMN account_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_income_account  ON income_entries(account_id);
CREATE INDEX idx_expense_account ON expenses(account_id);
