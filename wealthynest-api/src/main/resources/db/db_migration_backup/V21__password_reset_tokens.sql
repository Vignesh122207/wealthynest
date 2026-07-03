CREATE TABLE password_reset_tokens (
    id          UUID         NOT NULL DEFAULT gen_random_uuid(),
    token_hash  VARCHAR(64)  NOT NULL,
    email       VARCHAR(150) NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id),
    CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens(email);
