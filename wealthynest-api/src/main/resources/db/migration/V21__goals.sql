-- Savings goals, optionally auto-synced from a linked wallet account's live balance instead of
-- being manually updated (see GoalServiceImpl.toResponse()'s "effective saved amount").

CREATE TABLE goals (
    id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id     UUID          REFERENCES wallet_accounts(id) ON DELETE SET NULL,
    name           VARCHAR(100)  NOT NULL,
    icon           VARCHAR(10),
    color          VARCHAR(7),
    target_amount  NUMERIC(14,2) NOT NULL,
    saved_amount   NUMERIC(14,2) DEFAULT 0 NOT NULL,
    target_date    DATE,
    paused         BOOLEAN       DEFAULT false NOT NULL,
    created_at     TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at     TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by     UUID,
    modified_by    UUID
);

CREATE INDEX idx_goals_user_id ON goals (user_id);
CREATE INDEX idx_goals_account ON goals (account_id);
