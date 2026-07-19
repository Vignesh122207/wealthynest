-- In-app notifications (budget alerts, low balance, spend anomalies, debt/EMI reminders). Each
-- creator does its own once-per-day dedup by (user_id, type, title) before inserting.

CREATE TABLE notifications (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(40)  NOT NULL,
    title       VARCHAR(150) NOT NULL,
    message     TEXT         NOT NULL,
    is_read     BOOLEAN      DEFAULT false NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
