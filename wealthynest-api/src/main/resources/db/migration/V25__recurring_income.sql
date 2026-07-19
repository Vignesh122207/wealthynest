-- Recurring income rules (salary etc.), processed monthly by RecurringIncomeScheduler.
-- day_of_month: 1-31 clamps to the month's actual last day; 0 means "last working day".

CREATE TABLE recurring_income (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id            UUID          NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    source                VARCHAR(30)   DEFAULT 'SALARY' NOT NULL,
    amount                NUMERIC(15,2) NOT NULL,
    description           VARCHAR(255),
    day_of_month          INTEGER       NOT NULL,
    active                BOOLEAN       DEFAULT true NOT NULL,
    last_credited_month   INTEGER,
    last_credited_at      TIMESTAMP,
    created_at            TIMESTAMP     DEFAULT now() NOT NULL,
    updated_at            TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT recurring_income_day_of_month_check CHECK (day_of_month BETWEEN 0 AND 31)
);

CREATE INDEX idx_recurring_income_user    ON recurring_income (user_id, active);
CREATE INDEX idx_recurring_income_account ON recurring_income (account_id);
