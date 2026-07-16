-- Brute-force defense: track failed login attempts and a temporary lock window per user

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER    DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until           TIMESTAMPTZ;
