-- One participant's owed share of a family expense (Splitwise-style) — an IOU from
-- participant_user_id to payer_user_id, scoped to a single expense. The payer's own share isn't
-- represented here; only rows for the other participants exist. CASCADE on expense_id means
-- deleting the expense cleanly removes its splits at the DB level, even though the ORM layer
-- never models this as a JPA relationship.

CREATE TABLE expense_splits (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id            UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    family_id             UUID          NOT NULL,
    payer_user_id         UUID          NOT NULL,
    participant_user_id   UUID          NOT NULL,
    share_amount          NUMERIC(14,2) NOT NULL,
    status                VARCHAR(10)   DEFAULT 'PENDING' NOT NULL,
    settled_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at            TIMESTAMPTZ   DEFAULT now() NOT NULL
);

CREATE INDEX idx_expense_splits_expense     ON expense_splits (expense_id);
CREATE INDEX idx_expense_splits_participant ON expense_splits (participant_user_id, status);
CREATE INDEX idx_expense_splits_payer       ON expense_splits (payer_user_id, status);
