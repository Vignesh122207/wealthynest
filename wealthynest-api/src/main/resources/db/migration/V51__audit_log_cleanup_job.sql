-- Registers AUDIT_LOG_CLEANUP so it shows up in the admin job scheduler UI, same as every other
-- job. Daily, not weekly like MF_MASTER_SYNC/STOCK_WEEKLY_REFRESH - audit_logs accumulates
-- continuously (every login/action writes a row), so a small daily trim keeps the table bounded
-- instead of letting a backlog build up between runs. Off-peak hour, same reasoning as
-- MF_MASTER_SYNC's own off-peak slot.

-- idx_audit_logs_user (V17__audit_logs.sql) is (user_id, created_at DESC) - not usable for a
-- cleanup query that filters on created_at alone across every user. Without this, the retention
-- DELETE would be a full table scan.
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at);

INSERT INTO job_schedule_config (job_name, display_name, cron_expression, timezone, enabled)
VALUES ('AUDIT_LOG_CLEANUP', 'Audit Log Cleanup', '0 0 3 * * *', 'Asia/Kolkata', true)
ON CONFLICT (job_name) DO NOTHING;
