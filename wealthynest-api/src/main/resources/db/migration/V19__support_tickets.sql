-- Support tickets use native Postgres ENUM types (not the VARCHAR+CHECK convention used
-- elsewhere) because SupportTicket.java deliberately maps them via Hibernate's
-- @JdbcTypeCode(SqlTypes.NAMED_ENUM) — a real, working choice, not an inconsistency to "fix"
-- here; changing it would require updating the entity in lockstep. The one known side effect is
-- that H2 (used for the Spring context test) doesn't understand named enum types, which is why
-- that test logs a caught, non-fatal schema-validation warning for this table.

CREATE TYPE ticket_category AS ENUM
    ('BUG_REPORT', 'FEATURE_REQUEST', 'ACCOUNT_ISSUE', 'DATA_SYNC_ISSUE', 'GENERAL_QUESTION');

CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE support_tickets (
    id          UUID             DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     VARCHAR(200)     NOT NULL,
    category    ticket_category  DEFAULT 'GENERAL_QUESTION' NOT NULL,
    description TEXT             NOT NULL,
    status      ticket_status    DEFAULT 'OPEN' NOT NULL,
    priority    ticket_priority  DEFAULT 'MEDIUM' NOT NULL,
    created_at  TIMESTAMP        DEFAULT now() NOT NULL,
    updated_at  TIMESTAMP        DEFAULT now() NOT NULL
);

CREATE INDEX idx_ticket_user   ON support_tickets (user_id, created_at DESC);
CREATE INDEX idx_ticket_status ON support_tickets (status, created_at DESC);
