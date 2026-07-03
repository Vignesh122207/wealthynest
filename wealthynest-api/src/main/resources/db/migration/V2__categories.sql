-- Expense / income categories with system seeds

CREATE TABLE IF NOT EXISTS categories (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id  UUID        REFERENCES families(id) ON DELETE CASCADE,
    user_id    UUID        REFERENCES users(id)    ON DELETE CASCADE,
    name       VARCHAR(80) NOT NULL,
    icon       VARCHAR(50),
    color      VARCHAR(7),
    type       VARCHAR(20) NOT NULL,
    is_system  BOOLEAN     DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_by UUID,
    modified_by UUID,
    CONSTRAINT categories_type_check CHECK (type IN ('EXPENSE', 'INCOME', 'TRANSFER'))
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories (user_id);

-- System categories (shared across all users, family_id/user_id = NULL)
INSERT INTO categories (id, family_id, name, icon, color, type, is_system) VALUES
  (gen_random_uuid(), NULL, 'Food & Dining',   'utensils',      '#ef4444', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Groceries',       'shopping-cart', '#f97316', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Transportation',  'car',           '#eab308', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Utilities',       'zap',           '#3b82f6', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Healthcare',      'heart',         '#ec4899', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Education',       'book',          '#8b5cf6', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Entertainment',   'tv',            '#06b6d4', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Shopping',        'shopping-bag',  '#84cc16', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Home & Rent',     'home',          '#6366f1', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Insurance',       'shield',        '#14b8a6', 'EXPENSE', true),
  (gen_random_uuid(), NULL, 'Salary',          'briefcase',     '#22c55e', 'INCOME',  true),
  (gen_random_uuid(), NULL, 'Business Income', 'building',      '#16a34a', 'INCOME',  true),
  (gen_random_uuid(), NULL, 'Dividend Income', 'dollar-sign',   '#15803d', 'INCOME',  true),
  (gen_random_uuid(), NULL, 'Other Income',    'plus-circle',   '#166534', 'INCOME',  true);
