-- Recurring transfers (auto-move money account-to-account each month)

CREATE TABLE IF NOT EXISTS recurring_transfer (
    id                      UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_account_id         UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    to_account_id           UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    amount                  NUMERIC(15,2) NOT NULL,
    description             VARCHAR(255),
    day_of_month            INTEGER       NOT NULL CHECK (day_of_month BETWEEN 0 AND 31),
    active                  BOOLEAN       NOT NULL DEFAULT true,
    last_transferred_month  INTEGER,
    last_transferred_at     TIMESTAMP,
    created_at              TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_transfer_user ON recurring_transfer (user_id, active);

INSERT INTO job_schedule_config (job_name, display_name, cron_expression)
VALUES ('RECURRING_TRANSFER', 'Recurring Transfers (Auto account-to-account)', '0 0 9 * * *')
ON CONFLICT (job_name) DO NOTHING;
