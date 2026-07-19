-- App users. Auth fields (password, PIN, lockout counters) live here rather than a separate
-- credentials table since every auth method (password, PIN, WebAuthn, Google) ultimately resolves
-- to one user row.

CREATE TABLE users (
    id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id              UUID         REFERENCES families(id) ON DELETE SET NULL,
    full_name              VARCHAR(100) NOT NULL,
    email                  VARCHAR(150) NOT NULL,
    pending_email          VARCHAR(150),
    password_hash          TEXT         NOT NULL,
    role                   VARCHAR(20)  DEFAULT 'MEMBER' NOT NULL,
    avatar_url             TEXT,
    is_active              BOOLEAN      DEFAULT true NOT NULL,
    email_verified         BOOLEAN      DEFAULT true NOT NULL,
    auth_provider          VARCHAR(20)  DEFAULT 'LOCAL' NOT NULL,
    last_login_at          TIMESTAMPTZ,
    failed_login_attempts  INTEGER      DEFAULT 0 NOT NULL,
    locked_until           TIMESTAMPTZ,
    pin_hash               VARCHAR(255),
    pin_enabled_at         TIMESTAMPTZ,
    pin_failed_attempts    INTEGER      DEFAULT 0 NOT NULL,
    pin_locked_until       TIMESTAMPTZ,
    created_at             TIMESTAMPTZ  DEFAULT now() NOT NULL,
    updated_at             TIMESTAMPTZ  DEFAULT now() NOT NULL,
    created_by             UUID,
    modified_by            UUID,
    CONSTRAINT users_email_key  UNIQUE (email),
    CONSTRAINT users_role_check CHECK (role IN ('ADMIN', 'FAMILY_ADMIN', 'MEMBER'))
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_family ON users (family_id);
