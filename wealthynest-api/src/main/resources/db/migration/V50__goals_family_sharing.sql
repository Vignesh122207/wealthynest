-- Shared family goals — same convention as budgets/categories/expenses/assets/liabilities:
-- family_id is set alongside user_id (the creator), never instead of it, so "shared" is simply
-- family_id IS NOT NULL. Unlike budgets, goals have no per-category uniqueness constraint, so no
-- partial unique indexes are needed here.
ALTER TABLE goals ADD COLUMN family_id UUID REFERENCES families(id) ON DELETE CASCADE;

CREATE INDEX idx_goals_family_id ON goals (family_id);
