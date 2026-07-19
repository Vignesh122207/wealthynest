-- Expense transactions. category_id has no ON DELETE cascade (categories are always soft-deleted
-- via archived instead, so historical expenses keep resolving a real category name/color/icon).

CREATE TABLE expenses (
    id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id          UUID          NOT NULL REFERENCES users(id),
    family_id        UUID          REFERENCES families(id),
    category_id      UUID          NOT NULL REFERENCES categories(id),
    budget_id        UUID          REFERENCES budgets(id) ON DELETE SET NULL,
    account_id       UUID          REFERENCES wallet_accounts(id) ON DELETE SET NULL,
    amount           NUMERIC(14,2) NOT NULL,
    currency         VARCHAR(3)    DEFAULT 'INR' NOT NULL,
    description      TEXT,
    notes            TEXT,
    expense_date     DATE          NOT NULL,
    payment_method   VARCHAR(30),
    is_recurring     BOOLEAN       DEFAULT false NOT NULL,
    recurrence_rule  VARCHAR(50),
    is_debt          BOOLEAN       DEFAULT false NOT NULL,
    created_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by       UUID,
    modified_by      UUID,
    CONSTRAINT expenses_amount_check         CHECK (amount > 0),
    CONSTRAINT expenses_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('CASH', 'BANK_ACCOUNT', 'CREDIT_CARD'))
);

CREATE INDEX idx_expenses_user_date   ON expenses (user_id,   expense_date DESC);
CREATE INDEX idx_expenses_family_date ON expenses (family_id, expense_date DESC);
CREATE INDEX idx_expenses_category    ON expenses (category_id);
CREATE INDEX idx_expenses_budget      ON expenses (budget_id);
CREATE INDEX idx_expense_account      ON expenses (account_id);
