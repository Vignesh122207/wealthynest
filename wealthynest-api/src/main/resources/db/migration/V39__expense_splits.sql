CREATE TABLE IF NOT EXISTS expense_splits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id          UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    family_id           UUID NOT NULL,
    payer_user_id       UUID NOT NULL,
    participant_user_id UUID NOT NULL,
    share_amount        NUMERIC(14,2) NOT NULL,
    status              VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    settled_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense     ON expense_splits (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_participant ON expense_splits (participant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_expense_splits_payer       ON expense_splits (payer_user_id, status);
