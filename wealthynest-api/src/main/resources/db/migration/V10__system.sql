-- System tables: notifications, audit logs, net worth snapshots, background job config

CREATE TABLE IF NOT EXISTS notifications (
    id         UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(40)  NOT NULL,
    title      VARCHAR(150) NOT NULL,
    message    TEXT         NOT NULL,
    is_read    BOOLEAN      DEFAULT false NOT NULL,
    metadata   JSONB,
    created_at TIMESTAMPTZ  DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID,
    action      VARCHAR(80)  NOT NULL,
    entity_type VARCHAR(60),
    entity_id   UUID,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id        UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id   UUID          NOT NULL,
    year      INTEGER       NOT NULL,
    month     INTEGER       NOT NULL,
    net_worth NUMERIC(18,2) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP    DEFAULT now() NOT NULL,
    CONSTRAINT net_worth_snapshots_user_id_year_month_key UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_nw_snapshot_user ON net_worth_snapshots (user_id, year, month);

CREATE TABLE IF NOT EXISTS job_schedule_config (
    job_name         VARCHAR(50)  PRIMARY KEY,
    display_name     VARCHAR(100) NOT NULL,
    cron_expression  VARCHAR(100) NOT NULL,
    timezone         VARCHAR(50)  DEFAULT 'Asia/Kolkata' NOT NULL,
    enabled          BOOLEAN      DEFAULT true NOT NULL,
    last_run_at      TIMESTAMP,
    last_run_status  VARCHAR(20),
    last_run_message TEXT
);

-- Background jobs (ON CONFLICT so re-running on existing DB is safe)
INSERT INTO job_schedule_config (job_name, display_name, cron_expression) VALUES
  ('AUTO_INCOME',         'Auto Income (Dividends / Coupons / FD Maturity)', '0 0 20 * * *'),
  ('GOLD_PRICE',          'Gold Price Refresh',                               '0 0 10 * * *'),
  ('MF_NAV',              'Mutual Fund NAV Refresh',                          '0 30 21 * * MON-FRI'),
  ('RECURRING_EXPENSES',  'Recurring Expense Processor',                      '0 0 1 * * *'),
  ('NSE_EOD',             'NSE End-of-Day (Stock Prices + Dividends)',        '0 0 18 * * MON-FRI')
ON CONFLICT (job_name) DO NOTHING;
