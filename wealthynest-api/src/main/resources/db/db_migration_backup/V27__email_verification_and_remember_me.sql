-- Email verification: all existing users are considered verified (they pre-date this feature)
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT true;

-- New registrations will have email_verified = false (set in code)
CREATE TABLE email_verification_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evt_user_id  ON email_verification_tokens(user_id);
CREATE INDEX idx_evt_token    ON email_verification_tokens(token_hash);

-- Recurring expense scheduler job
INSERT INTO job_schedule_config (job_name, display_name, cron_expression)
VALUES ('RECURRING_EXPENSES', 'Recurring Expense Processor', '0 0 1 * * *')
ON CONFLICT (job_name) DO NOTHING;
