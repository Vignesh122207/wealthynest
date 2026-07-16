-- Brings the two remaining static @Scheduled jobs under the same DB-configurable /
-- admin-triggerable mechanism as the other five jobs (job_schedule_config).
INSERT INTO job_schedule_config (job_name, display_name, cron_expression, timezone) VALUES
  ('NET_WORTH_SNAPSHOT',   'Net Worth Monthly Snapshot',        '0 0 2 1 * *',      'Asia/Kolkata'),
  ('STOCK_WEEKLY_REFRESH', 'Stock Master + Corporate Actions (Weekly)', '0 0 2 * * SUN', 'Asia/Kolkata')
ON CONFLICT (job_name) DO NOTHING;
