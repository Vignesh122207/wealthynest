-- Lets refresh()'s reuse-detection tell a benign multi-tab rotation race (the same soon-to-be-stale
-- token presented again a moment after another tab already rotated it) apart from a token actually
-- being reused well after rotation, which is a real theft signal. Nullable and only ever set by
-- refresh()'s own rotation — every other revocation path (logout, password reset, explicit session
-- revoke) leaves it null, which reuse-detection treats as "always within grace" i.e. never escalates,
-- the same conservative reject-only behavior those paths already had.

ALTER TABLE refresh_tokens
    ADD COLUMN revoked_at TIMESTAMPTZ;
