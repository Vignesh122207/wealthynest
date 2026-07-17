-- Long-lived refresh tokens (hashed) backing the access/refresh JWT pair.

CREATE TABLE refresh_tokens (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT        NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked      BOOLEAN     DEFAULT false NOT NULL,
    remember_me  BOOLEAN     DEFAULT true NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
