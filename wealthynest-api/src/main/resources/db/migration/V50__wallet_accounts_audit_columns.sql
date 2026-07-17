-- wallet_accounts was the one entity in the codebase not extending BaseEntity, so it never had
-- created_by/modified_by like every other major table. Bringing it in line.

ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS modified_by UUID;
