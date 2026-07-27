-- Backfills job_schedule_config rows that exist only in the live database today (inserted
-- out-of-band at some point, never captured in a migration — V39 is the only prior migration
-- that seeds this table). ON CONFLICT DO NOTHING makes this a no-op against the current database
-- (values below were read directly from it) while making a *fresh* database — a new environment,
-- disaster recovery, or a from-scratch CI run — actually schedule every job instead of silently
-- only having MF_MASTER_SYNC. Cron values match what's live today; adjust via the admin Jobs tab
-- if a schedule ever needs to change, not by editing this file.

INSERT INTO job_schedule_config (job_name, display_name, cron_expression, timezone, enabled) VALUES
    ('AUTO_INCOME',                 'Auto Income (Dividends / Coupons / FD Maturity)',        '0 0 20 * * *',        'Asia/Kolkata', true),
    ('NSE_EOD',                     'NSE End-of-Day (Stock Prices + Dividends)',              '0 0 18 * * MON-FRI',  'Asia/Kolkata', true),
    ('GOLD_PRICE',                  'Gold Price Refresh',                                     '0 0 10 * * *',        'Asia/Kolkata', true),
    ('MF_NAV',                      'Mutual Fund NAV Refresh',                                '0 30 21 * * MON-FRI', 'Asia/Kolkata', true),
    ('RECURRING_EXPENSES',          'Recurring Expense Processor',                            '0 0 1 * * *',         'Asia/Kolkata', true),
    ('RECURRING_INCOME',            'Recurring Income (Auto Salary / Monthly Credits)',       '0 0 9 * * *',         'Asia/Kolkata', true),
    ('NET_WORTH_SNAPSHOT',          'Net Worth Monthly Snapshot',                             '0 0 2 1 * *',         'Asia/Kolkata', true),
    ('STOCK_WEEKLY_REFRESH',        'Stock Master + Corporate Actions (Weekly)',              '0 0 2 * * SUN',       'Asia/Kolkata', true),
    ('LOAN_EMI',                    'Loan EMI Auto-Pay',                                      '0 30 5 * * *',        'Asia/Kolkata', true),
    ('LOW_BALANCE_CHECK',           'Low Balance Check (accounts below threshold)',           '0 0 9 * * *',         'Asia/Kolkata', true),
    ('SPEND_ANOMALY_CHECK',         'Spend Anomaly Check (unusually large expenses)',         '0 15 9 * * *',        'Asia/Kolkata', true),
    ('DEBT_DUE_REMINDER',           'Debt Due Reminder (personal IOUs approaching due date)', '0 30 8 * * *',        'Asia/Kolkata', true),
    ('LOAN_EMI_REMINDER',           'Loan EMI Reminder (heads-up before autopay)',            '0 0 8 * * *',         'Asia/Kolkata', true),
    ('RECURRING_TRANSFER',          'Recurring Transfers (Auto account-to-account)',          '0 0 9 * * *',         'Asia/Kolkata', true),
    ('RECURRING_GOAL_CONTRIBUTION', 'Recurring Goal Contributions (Auto-fund goals)',         '0 0 9 * * *',         'Asia/Kolkata', true)
ON CONFLICT (job_name) DO NOTHING;
