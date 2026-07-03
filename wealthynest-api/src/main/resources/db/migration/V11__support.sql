-- Customer support tickets and replies

DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ticket_category AS ENUM (
        'BUG_REPORT', 'FEATURE_REQUEST', 'ACCOUNT_ISSUE', 'DATA_SYNC_ISSUE', 'GENERAL_QUESTION'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS support_tickets (
    id          UUID                     DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     VARCHAR(200)             NOT NULL,
    category    ticket_category          DEFAULT 'GENERAL_QUESTION' NOT NULL,
    description TEXT                     NOT NULL,
    status      ticket_status            DEFAULT 'OPEN'   NOT NULL,
    priority    ticket_priority          DEFAULT 'MEDIUM' NOT NULL,
    created_at  TIMESTAMP                DEFAULT now() NOT NULL,
    updated_at  TIMESTAMP                DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_user   ON support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets (status,  created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_replies (
    id             UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id      UUID      NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id        UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message        TEXT      NOT NULL,
    is_admin_reply BOOLEAN   DEFAULT false NOT NULL,
    created_at     TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reply_ticket ON ticket_replies (ticket_id, created_at);
