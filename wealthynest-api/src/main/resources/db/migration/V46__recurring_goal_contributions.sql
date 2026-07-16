-- Recurring goal contributions (auto-bump a goal's saved amount each month)

CREATE TABLE IF NOT EXISTS recurring_goal_contribution (
    id                      UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id                 UUID          NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount                  NUMERIC(15,2) NOT NULL,
    day_of_month            INTEGER       NOT NULL CHECK (day_of_month BETWEEN 0 AND 31),
    active                  BOOLEAN       NOT NULL DEFAULT true,
    last_contributed_month  INTEGER,
    last_contributed_at     TIMESTAMP,
    created_at              TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_goal_contribution_user ON recurring_goal_contribution (user_id, active);

INSERT INTO job_schedule_config (job_name, display_name, cron_expression)
VALUES ('RECURRING_GOAL_CONTRIBUTION', 'Recurring Goal Contributions (Auto-fund goals)', '0 0 9 * * *')
ON CONFLICT (job_name) DO NOTHING;
