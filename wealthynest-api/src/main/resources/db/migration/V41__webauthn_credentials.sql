CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL,
    credential_id  BYTEA NOT NULL,
    aaguid         BYTEA NOT NULL,
    public_key_cose BYTEA NOT NULL,
    sign_count     BIGINT NOT NULL DEFAULT 0,
    transports     VARCHAR(100),
    nickname       VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at   TIMESTAMPTZ,
    CONSTRAINT uq_webauthn_credential_id UNIQUE (credential_id)
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials (user_id);
