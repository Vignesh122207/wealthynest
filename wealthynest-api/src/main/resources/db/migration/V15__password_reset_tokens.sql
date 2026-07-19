-- Deliberately keyed by email, not user_id — the forgot-password flow is enumeration-safe (always
-- returns success regardless of whether the email exists), so it never needs to resolve a user row
-- up front.

CREATE TABLE password_reset_tokens (
    id          UUID         DEFAULT gen_random_uuid(),
    token_hash  VARCHAR(64)  NOT NULL,
    email       VARCHAR(150) NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used        BOOLEAN      DEFAULT false NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id),
    CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens (email);
