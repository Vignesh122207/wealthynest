INSERT INTO job_schedule_config (job_name, display_name, cron_expression) VALUES
  ('DEBT_DUE_REMINDER', 'Debt Due Reminder (personal IOUs approaching due date)', '0 30 8 * * *'),
  ('LOAN_EMI_REMINDER',  'Loan EMI Reminder (heads-up before autopay)',            '0 0 8 * * *')
ON CONFLICT (job_name) DO NOTHING;
