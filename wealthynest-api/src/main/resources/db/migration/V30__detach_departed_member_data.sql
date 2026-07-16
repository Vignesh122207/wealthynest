-- Repair: revert data to personal where its owner is no longer a member of the tagged family.
-- leaveFamily/removeMember used to clear only users.family_id, leaving the member's
-- categories/expenses/budgets (and potentially assets/liabilities) visible in the family's
-- shared views. The service layer now detaches on leave/remove; this fixes rows left behind.
-- Rows with a NULL user_id (created collectively under the family) are intentionally untouched.

UPDATE categories c SET family_id = NULL
 WHERE c.family_id IS NOT NULL AND c.user_id IS NOT NULL AND c.is_system = false
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id AND u.family_id = c.family_id);

UPDATE expenses e SET family_id = NULL
 WHERE e.family_id IS NOT NULL AND e.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id AND u.family_id = e.family_id);

UPDATE budgets b SET family_id = NULL
 WHERE b.family_id IS NOT NULL AND b.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = b.user_id AND u.family_id = b.family_id);

UPDATE assets a SET family_id = NULL
 WHERE a.family_id IS NOT NULL AND a.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id AND u.family_id = a.family_id);

UPDATE liabilities l SET family_id = NULL
 WHERE l.family_id IS NOT NULL AND l.user_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = l.user_id AND u.family_id = l.family_id);
