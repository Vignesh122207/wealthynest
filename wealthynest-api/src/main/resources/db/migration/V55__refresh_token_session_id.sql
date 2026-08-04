-- V54's grace-window race handling mints an entirely new, independent refresh_tokens row when a
-- token is reused within REFRESH_REUSE_GRACE_MS of its own rotation (see refresh()'s own comment
-- on that path). That row has no link back to the session it actually belongs to, so the same
-- physical device/browser accumulates lookalike rows every time the benign multi-tab race fires —
-- each shows up as its own entry in the Security settings "Active sessions" list, even though
-- they're all the same login. session_id carries a stable lineage id across every rotation of a
-- given login (including race-minted siblings), so listSessions can group rows back into one
-- entry per real session instead of one per row.
ALTER TABLE refresh_tokens
    ADD COLUMN session_id UUID;

-- Backfill: existing rows have no recorded lineage, so each stands as its own session.
UPDATE refresh_tokens SET session_id = id WHERE session_id IS NULL;

ALTER TABLE refresh_tokens
    ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens (session_id);
