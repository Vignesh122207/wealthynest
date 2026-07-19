-- Recurring goal contributions, processed monthly by RecurringGoalContributionScheduler.
-- Same day_of_month semantics as recurring_income (0 = last working day).

CREATE TABLE recurring_goal_contribution (
    id                        UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                   UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id                   UUID          NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    amount                    NUMERIC(15,2) NOT NULL,
    day_of_month              INTEGER       NOT NULL,
    active                    BOOLEAN       DEFAULT true NOT NULL,
    last_contributed_month    INTEGER,
    last_contributed_at       TIMESTAMP,
    created_at                TIMESTAMP     DEFAULT now() NOT NULL,
    updated_at                TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT recurring_goal_contribution_day_of_month_check CHECK (day_of_month BETWEEN 0 AND 31)
);

CREATE INDEX idx_recurring_goal_contribution_user ON recurring_goal_contribution (user_id, active);
CREATE INDEX idx_recurring_goal_contribution_goal ON recurring_goal_contribution (goal_id);
