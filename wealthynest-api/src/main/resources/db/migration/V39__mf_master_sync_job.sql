-- Registers the new MF_MASTER_SYNC job so it shows up in the admin job scheduler UI, same as
-- every other job. Weekly, same rhythm as STOCK_WEEKLY_REFRESH — scheme names change rarely.

INSERT INTO job_schedule_config (job_name, display_name, cron_expression, timezone, enabled)
VALUES ('MF_MASTER_SYNC', 'Mutual Fund Master Sync', '0 30 2 * * SUN', 'Asia/Kolkata', true)
ON CONFLICT (job_name) DO NOTHING;
