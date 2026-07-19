-- Personal debt tracker: money lent to (LENT) or borrowed from (BORROWED) someone outside the
-- app's accounts — modeled as one-sided AccountTransfers against account_id when a real wallet
-- account is involved (see linked_transfer_id / DebtServiceImpl).

CREATE TABLE debt_records (
    id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id           UUID          REFERENCES wallet_accounts(id) ON DELETE SET NULL,
    type                 VARCHAR(10)   NOT NULL,
    contact_name         VARCHAR(100)  NOT NULL,
    contact_phone        VARCHAR(20),
    amount               NUMERIC(15,2) NOT NULL,
    description          VARCHAR(255),
    debt_date            DATE,
    due_date             DATE,
    status               VARCHAR(10)   DEFAULT 'ACTIVE' NOT NULL,
    amount_settled       NUMERIC(15,2) DEFAULT 0 NOT NULL,
    linked_transfer_id   UUID,
    created_at           TIMESTAMP     DEFAULT now() NOT NULL,
    updated_at           TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT debt_records_type_check   CHECK (type IN ('LENT', 'BORROWED')),
    CONSTRAINT debt_records_status_check CHECK (status IN ('ACTIVE', 'SETTLED', 'PARTIAL'))
);

CREATE INDEX idx_debt_records_user    ON debt_records (user_id, status);
CREATE INDEX idx_debt_records_account ON debt_records (account_id);
