CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID REFERENCES families(id) ON DELETE CASCADE,
    name        VARCHAR(80)  NOT NULL,
    icon        VARCHAR(50),
    color       VARCHAR(7),
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('EXPENSE','INCOME','TRANSFER')),
    is_system   BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  UUID,
    modified_by UUID
);

CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES users(id),
    family_id       UUID         REFERENCES families(id),
    category_id     UUID         NOT NULL REFERENCES categories(id),
    amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency        VARCHAR(3)   NOT NULL DEFAULT 'INR',
    description     TEXT,
    notes           TEXT,
    expense_date    DATE         NOT NULL,
    is_recurring    BOOLEAN      NOT NULL DEFAULT false,
    recurrence_rule VARCHAR(50),
    payment_method  VARCHAR(30)  CHECK (payment_method IN
                        ('CASH','UPI','CREDIT_CARD','DEBIT_CARD','NET_BANKING','OTHER')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      UUID,
    modified_by     UUID
);

CREATE INDEX idx_expenses_user_date   ON expenses(user_id,   expense_date DESC);
CREATE INDEX idx_expenses_family_date ON expenses(family_id, expense_date DESC);
CREATE INDEX idx_expenses_category    ON expenses(category_id);

-- Seed system categories
INSERT INTO categories (id, family_id, name, icon, color, type, is_system) VALUES
(gen_random_uuid(), NULL, 'Food & Dining',    'utensils',      '#ef4444', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Groceries',        'shopping-cart', '#f97316', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Transportation',   'car',           '#eab308', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Utilities',        'zap',           '#3b82f6', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Healthcare',       'heart',         '#ec4899', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Education',        'book',          '#8b5cf6', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Entertainment',    'tv',            '#06b6d4', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Shopping',         'shopping-bag',  '#84cc16', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Home & Rent',      'home',          '#6366f1', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Insurance',        'shield',        '#14b8a6', 'EXPENSE', true),
(gen_random_uuid(), NULL, 'Salary',           'briefcase',     '#22c55e', 'INCOME',  true),
(gen_random_uuid(), NULL, 'Business Income',  'building',      '#16a34a', 'INCOME',  true),
(gen_random_uuid(), NULL, 'Dividend Income',  'dollar-sign',   '#15803d', 'INCOME',  true),
(gen_random_uuid(), NULL, 'Other Income',     'plus-circle',   '#166534', 'INCOME',  true);
