-- Vault Health: reused/weak/breached password detection without ever decrypting a secret
-- outside the normal step-up-gated reveal flow. secret_hash is a keyed HMAC-SHA256 (pepper
-- distinct from VAULT_ENCRYPTION_KEY) computed at write time, so reuse detection is just a
-- GROUP BY on non-sensitive data. strength_level mirrors the client heuristic. breach_count is
-- nullable: NULL means "not yet checked / HIBP was unreachable at write time", distinct from
-- 0 ("checked, clean") — the breach check fails open and must never block a save.
ALTER TABLE vault_items ADD COLUMN secret_hash    VARCHAR(64);
ALTER TABLE vault_items ADD COLUMN strength_level INTEGER;
ALTER TABLE vault_items ADD COLUMN breach_count   INTEGER;

CREATE INDEX idx_vault_items_user_secret_hash ON vault_items (user_id, secret_hash);
