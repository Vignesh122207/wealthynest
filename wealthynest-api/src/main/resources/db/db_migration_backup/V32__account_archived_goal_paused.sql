-- Archive flag on accounts: lets users hide closed accounts without losing history
ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Pause flag on goals: lets users temporarily suspend a goal without deleting it
ALTER TABLE goals ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE;
