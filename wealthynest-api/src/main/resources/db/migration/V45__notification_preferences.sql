-- Per-user opt-out for the server-generated alert types (budget/low-balance/anomaly/debt/EMI).
-- One row per user, created lazily on first preference read or write; absence of a row means
-- every alert type defaults to enabled.

CREATE TABLE notification_preferences (
    user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    budget_alert_enabled  BOOLEAN     DEFAULT true NOT NULL,
    low_balance_enabled   BOOLEAN     DEFAULT true NOT NULL,
    spend_anomaly_enabled BOOLEAN     DEFAULT true NOT NULL,
    debt_due_enabled      BOOLEAN     DEFAULT true NOT NULL,
    loan_emi_enabled      BOOLEAN     DEFAULT true NOT NULL,
    created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);
