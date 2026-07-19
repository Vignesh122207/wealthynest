-- Recurring account-to-account transfers, processed monthly by RecurringTransferScheduler.
-- Same day_of_month semantics as recurring_income (0 = last working day).

CREATE TABLE recurring_transfer (
    id                       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                  UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_account_id          UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    to_account_id            UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    amount                   NUMERIC(15,2) NOT NULL,
    description              VARCHAR(255),
    day_of_month             INTEGER       NOT NULL,
    active                   BOOLEAN       DEFAULT true NOT NULL,
    last_transferred_month   INTEGER,
    last_transferred_at      TIMESTAMP,
    created_at               TIMESTAMP     DEFAULT now() NOT NULL,
    updated_at               TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT recurring_transfer_day_of_month_check CHECK (day_of_month BETWEEN 0 AND 31)
);

CREATE INDEX idx_recurring_transfer_user ON recurring_transfer (user_id, active);
CREATE INDEX idx_recurring_transfer_from ON recurring_transfer (from_account_id);
CREATE INDEX idx_recurring_transfer_to   ON recurring_transfer (to_account_id);
