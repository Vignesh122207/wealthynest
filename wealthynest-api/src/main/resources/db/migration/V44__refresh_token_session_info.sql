-- Lets an active (non-revoked, non-expired) refresh_tokens row double as an "active session" for
-- the Security settings device list — each row already corresponds 1:1 with a signed-in device,
-- since refresh() revokes the old row and mints a new one on every rotation instead of updating
-- in place.

ALTER TABLE refresh_tokens
    ADD COLUMN ip_address TEXT,
    ADD COLUMN user_agent TEXT;

CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens (user_id, revoked, expires_at);
