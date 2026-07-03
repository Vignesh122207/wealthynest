INSERT INTO categories (id, family_id, name, icon, color, type, is_system)
SELECT gen_random_uuid(), NULL, 'Other', 'more-horizontal', '#94a3b8', 'EXPENSE', true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Other' AND type = 'EXPENSE' AND is_system = true
);
