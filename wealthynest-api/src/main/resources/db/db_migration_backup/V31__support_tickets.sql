CREATE TYPE ticket_status   AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','CLOSED');
CREATE TYPE ticket_priority AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
CREATE TYPE ticket_category AS ENUM ('BUG_REPORT','FEATURE_REQUEST','ACCOUNT_ISSUE','DATA_SYNC_ISSUE','GENERAL_QUESTION');

CREATE TABLE IF NOT EXISTS support_tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     VARCHAR(200) NOT NULL,
    category    ticket_category NOT NULL DEFAULT 'GENERAL_QUESTION',
    description TEXT NOT NULL,
    status      ticket_status   NOT NULL DEFAULT 'OPEN',
    priority    ticket_priority NOT NULL DEFAULT 'MEDIUM',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_replies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id     UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message       TEXT NOT NULL,
    is_admin_reply BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_user   ON support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reply_ticket  ON ticket_replies  (ticket_id, created_at ASC);
