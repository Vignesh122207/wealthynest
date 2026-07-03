-- Recurring income rules (auto-credit salary / freelance / etc. each month)

CREATE TABLE IF NOT EXISTS recurring_income (
    id                   UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id              UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id           UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    source               VARCHAR(30)   NOT NULL DEFAULT 'SALARY',
    amount               NUMERIC(15,2) NOT NULL,
    description          VARCHAR(255),
    day_of_month         INTEGER       NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
    active               BOOLEAN       NOT NULL DEFAULT true,
    last_credited_month  INTEGER,
    last_credited_at     TIMESTAMP,
    created_at           TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_income_user ON recurring_income (user_id, active);

-- Register the scheduler job
INSERT INTO job_schedule_config (job_name, display_name, cron_expression)
VALUES ('RECURRING_INCOME', 'Recurring Income (Auto Salary / Monthly Credits)', '0 0 9 * * *')
ON CONFLICT (job_name) DO NOTHING;
