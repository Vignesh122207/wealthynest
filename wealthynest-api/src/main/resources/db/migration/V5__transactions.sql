-- Expenses and income entries

CREATE TABLE IF NOT EXISTS expenses (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID          NOT NULL REFERENCES users(id),
    family_id       UUID          REFERENCES families(id),
    category_id     UUID          NOT NULL REFERENCES categories(id),
    budget_id       UUID          REFERENCES budgets(id),
    account_id      UUID          REFERENCES wallet_accounts(id),
    amount          NUMERIC(14,2) NOT NULL,
    currency        VARCHAR(3)    DEFAULT 'INR' NOT NULL,
    description     TEXT,
    notes           TEXT,
    expense_date    DATE          NOT NULL,
    payment_method  VARCHAR(30),
    is_recurring    BOOLEAN       DEFAULT false NOT NULL,
    recurrence_rule VARCHAR(50),
    created_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at      TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by      UUID,
    modified_by     UUID,
    CONSTRAINT expenses_amount_check          CHECK (amount > 0),
    CONSTRAINT expenses_payment_method_check  CHECK (payment_method IS NULL OR payment_method IN ('CASH', 'BANK_ACCOUNT', 'CREDIT_CARD'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date   ON expenses (user_id,   expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_family_date ON expenses (family_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category    ON expenses (category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_budget      ON expenses (budget_id);
CREATE INDEX IF NOT EXISTS idx_expense_account      ON expenses (account_id);

CREATE TABLE IF NOT EXISTS income_entries (
    id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id   UUID          REFERENCES wallet_accounts(id),
    source       VARCHAR(50)   NOT NULL,
    amount       NUMERIC(14,2) NOT NULL,
    description  VARCHAR(255),
    income_date  DATE          NOT NULL,
    period_month INTEGER       NOT NULL,
    period_year  INTEGER       NOT NULL,
    payment_mode VARCHAR(20)   DEFAULT 'BANK_ACCOUNT' NOT NULL,
    created_at   TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at   TIMESTAMPTZ   DEFAULT now() NOT NULL,
    CONSTRAINT income_entries_amount_check       CHECK (amount > 0),
    CONSTRAINT income_entries_period_month_check CHECK (period_month BETWEEN 1 AND 12),
    CONSTRAINT income_entries_payment_mode_check CHECK (payment_mode IN ('CASH', 'BANK_ACCOUNT')),
    CONSTRAINT income_entries_source_check       CHECK (source IN (
        'SALARY', 'FREELANCE', 'BUSINESS', 'RENTAL', 'BONUS', 'INTEREST', 'DIVIDEND', 'OTHER'))
);

CREATE INDEX IF NOT EXISTS idx_income_user_date   ON income_entries (user_id, income_date DESC);
CREATE INDEX IF NOT EXISTS idx_income_user_period ON income_entries (user_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_income_account     ON income_entries (account_id);
