-- Rename existing income system categories to match frontend INCOME_SOURCES labels
UPDATE categories SET name = 'Dividend'
WHERE name = 'Dividend Income' AND type = 'INCOME' AND is_system = true;

UPDATE categories SET name = 'Other'
WHERE name = 'Other Income' AND type = 'INCOME' AND is_system = true;

-- Add the 4 missing system income categories
INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT gen_random_uuid(), NULL, 'Freelance', 'laptop', '#06b6d4', 'INCOME', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Freelance' AND type = 'INCOME' AND is_system = true);

INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT gen_random_uuid(), NULL, 'Rental Income', 'home', '#f59e0b', 'INCOME', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Rental Income' AND type = 'INCOME' AND is_system = true);

INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT gen_random_uuid(), NULL, 'Bonus', 'gift', '#ec4899', 'INCOME', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Bonus' AND type = 'INCOME' AND is_system = true);

INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT gen_random_uuid(), NULL, 'Interest', 'percent', '#3b82f6', 'INCOME', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Interest' AND type = 'INCOME' AND is_system = true);
