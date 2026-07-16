ALTER TABLE wallet_accounts ADD COLUMN IF NOT EXISTS low_balance_threshold NUMERIC(14,2);

INSERT INTO job_schedule_config (job_name, display_name, cron_expression) VALUES
  ('LOW_BALANCE_CHECK',  'Low Balance Check (accounts below threshold)',        '0 0 9 * * *'),
  ('SPEND_ANOMALY_CHECK', 'Spend Anomaly Check (unusually large expenses)',     '0 15 9 * * *')
ON CONFLICT (job_name) DO NOTHING;
