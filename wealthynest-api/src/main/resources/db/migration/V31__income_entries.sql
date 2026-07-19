-- Income transactions. period_month/period_year are plain integer columns (not derived from
-- income_date via a function) specifically so period-scoped queries stay sargable — the same
-- pattern expenses' YEAR()/MONTH()-free date-range queries were rewritten to match.

CREATE TABLE income_entries (
    id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id    UUID          REFERENCES wallet_accounts(id) ON DELETE SET NULL,
    source        VARCHAR(50)   NOT NULL,
    amount        NUMERIC(14,2) NOT NULL,
    description   VARCHAR(255),
    income_date   DATE          NOT NULL,
    period_month  INTEGER       NOT NULL,
    period_year   INTEGER       NOT NULL,
    payment_mode  VARCHAR(20)   DEFAULT 'BANK_ACCOUNT' NOT NULL,
    is_debt       BOOLEAN       DEFAULT false NOT NULL,
    created_at    TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at    TIMESTAMPTZ   DEFAULT now() NOT NULL,
    CONSTRAINT income_entries_amount_check       CHECK (amount > 0),
    CONSTRAINT income_entries_period_month_check CHECK (period_month BETWEEN 1 AND 12),
    CONSTRAINT income_entries_payment_mode_check CHECK (payment_mode IN ('CASH', 'BANK_ACCOUNT')),
    CONSTRAINT income_entries_source_check       CHECK (source IN (
        'SALARY', 'FREELANCE', 'BUSINESS', 'RENTAL', 'BONUS', 'INTEREST', 'DIVIDEND', 'OTHER'))
);

CREATE INDEX idx_income_user_date   ON income_entries (user_id, income_date DESC);
CREATE INDEX idx_income_user_period ON income_entries (user_id, period_year, period_month);
CREATE INDEX idx_income_account     ON income_entries (account_id);
