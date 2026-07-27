-- FCM device tokens for push delivery. One row per (user, device) — a user can have several
-- rows for multiple devices; the token itself is the natural dedupe key since Firebase issues a
-- fresh one per app install/reset, so re-registering the same token just bumps last_seen_at.

CREATE TABLE device_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token         TEXT        NOT NULL UNIQUE,
    platform      VARCHAR(20) DEFAULT 'ANDROID' NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_seen_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
