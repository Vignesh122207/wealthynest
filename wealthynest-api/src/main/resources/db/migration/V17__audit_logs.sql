-- Immutable audit trail for admin/security-relevant actions (AuditService writes these
-- @Async/REQUIRES_NEW so a logging failure never breaks the action it's recording).

CREATE TABLE audit_logs (
    id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(80)  NOT NULL,
    entity_type  VARCHAR(60),
    entity_id    UUID,
    old_value    JSONB,
    new_value    JSONB,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    created_at   TIMESTAMPTZ  DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
