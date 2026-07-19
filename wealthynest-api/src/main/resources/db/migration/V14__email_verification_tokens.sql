-- Signup email verification AND email-change confirmation (via pendingEmail) share this table.

CREATE TABLE email_verification_tokens (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    token_hash  VARCHAR(64)  NOT NULL,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used        BOOLEAN      DEFAULT false NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX idx_evt_token   ON email_verification_tokens (token_hash);
CREATE INDEX idx_evt_user_id ON email_verification_tokens (user_id);
