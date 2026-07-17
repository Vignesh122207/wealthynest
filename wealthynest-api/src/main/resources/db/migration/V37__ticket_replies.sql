-- Threaded replies on a support ticket, from either the submitting user or an admin.

CREATE TABLE ticket_replies (
    id              UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id       UUID      NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id         UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT      NOT NULL,
    is_admin_reply  BOOLEAN   DEFAULT false NOT NULL,
    created_at      TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX idx_reply_ticket ON ticket_replies (ticket_id, created_at);
CREATE INDEX idx_reply_user   ON ticket_replies (user_id);
