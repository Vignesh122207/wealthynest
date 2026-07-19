-- Tracks which dividend suggestions (from nse_corporate_actions) a user has explicitly dismissed,
-- so DismissDividend doesn't keep re-suggesting the same ex-date.

CREATE TABLE dismissed_dividends (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    investment_id  UUID        NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    ex_date        DATE        NOT NULL,
    dismissed_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_dismissed_div UNIQUE (user_id, investment_id, ex_date)
);

CREATE INDEX idx_dismissed_div_user ON dismissed_dividends (user_id);
