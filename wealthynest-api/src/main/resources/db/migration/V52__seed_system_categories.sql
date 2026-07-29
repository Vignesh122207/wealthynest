-- System (is_system=true, no user/family owner) expense/income categories have never actually
-- been seeded by any migration - V10__categories.sql only creates the table. Every environment
-- that "worked" (prod, anyone's long-lived local dev Postgres) only had these because someone ran
-- a one-off manual INSERT against it at some point; a genuinely fresh database has none at all.
-- Confirmed broken this way in the E2E ephemeral stack (fresh Postgres every run): CSV statement
-- import's confirm step 500s with "No default expense category available" the moment it needs the
-- system "Other" EXPENSE category (StatementImportServiceImpl.findOtherExpenseCategoryId) and
-- finds nothing. Values below match exactly what's already relied upon in every long-lived
-- environment (verified against a real running instance), so this is a no-op there - it only
-- actually seeds a database that's missing them.
--
-- WHERE NOT EXISTS, not ON CONFLICT: uq_categories_name_type_system (V10) is DEFERRABLE (that
-- migration's own comment explains why), and Postgres flatly refuses ON CONFLICT DO NOTHING - with
-- or without an explicit conflict target - when a deferrable constraint is the only candidate
-- arbiter ("ON CONFLICT does not support deferrable unique constraints... as arbiters"; confirmed
-- this the hard way running the migration, target-less included). NOT EXISTS sidesteps arbiter
-- inference entirely and is equally idempotent for this one-time seed.
INSERT INTO categories (name, icon, color, type, is_system)
SELECT v.name, v.icon, v.color, v.type, true
FROM (VALUES
    ('Debt & Loans',    'handshake',       '#6366f1', 'EXPENSE'),
    ('Education',       'book',            '#8b5cf6', 'EXPENSE'),
    ('Entertainment',   'tv',              '#06b6d4', 'EXPENSE'),
    ('Food & Dining',   'utensils',        '#ef4444', 'EXPENSE'),
    ('Groceries',       'shopping-cart',   '#f97316', 'EXPENSE'),
    ('Healthcare',      'heart',           '#ec4899', 'EXPENSE'),
    ('Home & Rent',     'home',            '#6366f1', 'EXPENSE'),
    ('Insurance',       'shield',          '#14b8a6', 'EXPENSE'),
    ('Investments',     'trending-up',     '#6366f1', 'EXPENSE'),
    ('Loan Interest',   'percent',         '#f43f5e', 'EXPENSE'),
    ('Other',           'more-horizontal', '#94a3b8', 'EXPENSE'),
    ('Shopping',        'shopping-bag',    '#84cc16', 'EXPENSE'),
    ('Transportation',  'car',             '#eab308', 'EXPENSE'),
    ('Utilities',       'zap',             '#3b82f6', 'EXPENSE'),
    ('Bonus',           'gift',            '#ec4899', 'INCOME'),
    ('Business Income', 'building',        '#16a34a', 'INCOME'),
    ('Dividend',        'dollar-sign',     '#15803d', 'INCOME'),
    ('Freelance',       'laptop',          '#06b6d4', 'INCOME'),
    ('Interest',        'percent',         '#3b82f6', 'INCOME'),
    ('Other',           'plus-circle',     '#166534', 'INCOME'),
    ('Rental Income',   'home',            '#f59e0b', 'INCOME'),
    ('Salary',          'briefcase',       '#22c55e', 'INCOME')
) AS v(name, icon, color, type)
WHERE NOT EXISTS (
    SELECT 1 FROM categories c
    WHERE c.name = v.name AND c.type = v.type AND c.is_system = true
);
