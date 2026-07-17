-- Bank/cash/credit-card/loan/investment holdings. Balance is never stored — it's always computed
-- live from income/expense/transfer sums (see WalletAccountServiceImpl.enrich()) — so this table
-- only carries opening_balance plus per-type metadata (credit card limits, loan EMI fields).

CREATE TABLE wallet_accounts (
    id                      UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type            VARCHAR(20)   NOT NULL,
    name                    VARCHAR(100)  NOT NULL,
    bank_name               VARCHAR(100),
    account_number          VARCHAR(20),
    opening_balance         NUMERIC(14,2) DEFAULT 0 NOT NULL,
    low_balance_threshold   NUMERIC(14,2),
    archived                BOOLEAN       DEFAULT false NOT NULL,
    is_primary              BOOLEAN       DEFAULT false NOT NULL,
    -- Credit card fields (null for non-credit-card accounts)
    credit_limit            NUMERIC(15,2),
    statement_day           INTEGER,
    payment_due_day         INTEGER,
    apr                     NUMERIC(5,2),
    -- Loan fields (null for non-loan accounts; apr doubles as the loan rate, bank_name as the
    -- lender, opening_balance as the outstanding principal at creation)
    loan_type               VARCHAR(20),
    principal_amount        NUMERIC(16,2),
    emi_amount              NUMERIC(14,2),
    emi_day                 INTEGER,
    autopay_account_id      UUID,
    loan_end_date           DATE,
    last_emi_yyyymm         INTEGER,
    created_at              TIMESTAMP     DEFAULT now() NOT NULL,
    updated_at              TIMESTAMP     DEFAULT now() NOT NULL,
    created_by              UUID,
    modified_by             UUID,
    CONSTRAINT wallet_accounts_account_type_check CHECK (account_type IN
        ('CASH_WALLET', 'BANK_ACCOUNT', 'EMERGENCY_FUND', 'CREDIT_CARD', 'LOAN', 'INVESTMENT'))
);

-- Self-referencing FK (the bank account a loan's EMI auto-debits from) — added after the table
-- exists since a column can't reference its own not-yet-created table inline.
ALTER TABLE wallet_accounts
    ADD CONSTRAINT wallet_accounts_autopay_account_id_fkey
    FOREIGN KEY (autopay_account_id) REFERENCES wallet_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_wallet_accounts_user     ON wallet_accounts (user_id);
CREATE INDEX idx_wallet_accounts_autopay  ON wallet_accounts (autopay_account_id);

-- Only one CASH_WALLET and one EMERGENCY_FUND allowed per user (including archived — the service
-- layer gives a friendly message if the caller has an archived one instead of relaxing this).
CREATE UNIQUE INDEX wa_unique_cash      ON wallet_accounts (user_id) WHERE account_type = 'CASH_WALLET';
CREATE UNIQUE INDEX wa_unique_emergeny  ON wallet_accounts (user_id) WHERE account_type = 'EMERGENCY_FUND';
