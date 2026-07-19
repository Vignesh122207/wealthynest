-- Registered passkeys/security keys for WebAuthn login.

CREATE TABLE webauthn_credentials (
    id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id     BYTEA       NOT NULL,
    aaguid            BYTEA       NOT NULL,
    public_key_cose   BYTEA       NOT NULL,
    sign_count        BIGINT      DEFAULT 0 NOT NULL,
    transports        VARCHAR(100),
    nickname          VARCHAR(100),
    created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
    last_used_at      TIMESTAMPTZ,
    CONSTRAINT uq_webauthn_credential_id UNIQUE (credential_id)
);

CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials (user_id);
