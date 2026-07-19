-- Money moved between wallet accounts. from/to_account_id are both nullable to support one-sided
-- debt transfers (money lent/borrowed against an external party has no matching account on the
-- other side) — see the is_debt/debt_label/debt_contact_name columns and DebtServiceImpl.

CREATE TABLE account_transfers (
    id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID          NOT NULL REFERENCES users(id),
    from_account_id     UUID          REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    to_account_id       UUID          REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    amount              NUMERIC(14,2) NOT NULL,
    description         VARCHAR(255),
    transfer_date       DATE          NOT NULL,
    is_debt             BOOLEAN       DEFAULT false NOT NULL,
    debt_contact_name   VARCHAR(255),
    debt_label          VARCHAR(20),
    created_at          TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT account_transfers_amount_check CHECK (amount > 0)
);

CREATE INDEX idx_transfers_from ON account_transfers (from_account_id);
CREATE INDEX idx_transfers_to   ON account_transfers (to_account_id);
CREATE INDEX idx_transfers_user ON account_transfers (user_id);
