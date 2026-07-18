-- Optional TOTP (2FA) secret per LOGIN item, encrypted the same way as the main secret
-- (VaultEncryptionService, AES-256-GCM). Both columns nullable — most items have no TOTP.
ALTER TABLE vault_items ADD COLUMN totp_ciphertext TEXT;
ALTER TABLE vault_items ADD COLUMN totp_iv         TEXT;
