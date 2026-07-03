-- Authentication, users and family grouping

CREATE TABLE IF NOT EXISTS families (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    invite_code VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    created_by  UUID,
    modified_by UUID,
    CONSTRAINT families_invite_code_key UNIQUE (invite_code)
);

CREATE TABLE IF NOT EXISTS users (
    id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id      UUID         REFERENCES families(id),
    full_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL,
    password_hash  TEXT         NOT NULL,
    role           VARCHAR(20)  DEFAULT 'MEMBER' NOT NULL,
    avatar_url     TEXT,
    is_active      BOOLEAN      DEFAULT true NOT NULL,
    email_verified BOOLEAN      DEFAULT true NOT NULL,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  DEFAULT now() NOT NULL,
    updated_at     TIMESTAMPTZ  DEFAULT now() NOT NULL,
    created_by     UUID,
    modified_by    UUID,
    CONSTRAINT users_email_key   UNIQUE (email),
    CONSTRAINT users_role_check  CHECK (role IN ('ADMIN', 'FAMILY_ADMIN', 'MEMBER'))
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_family ON users (family_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT    NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN DEFAULT false NOT NULL,
    remember_me BOOLEAN DEFAULT true  NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    token_hash VARCHAR(64)  NOT NULL,
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ  NOT NULL,
    used       BOOLEAN      DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT now() NOT NULL,
    CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_evt_token   ON email_verification_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_evt_user_id ON email_verification_tokens (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    token_hash VARCHAR(64) NOT NULL,
    email      VARCHAR(150) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used       BOOLEAN      DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ  DEFAULT now() NOT NULL,
    CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens (email);
