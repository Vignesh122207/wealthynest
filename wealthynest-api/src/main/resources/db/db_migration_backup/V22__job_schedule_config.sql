CREATE TABLE job_schedule_config (
    job_name         VARCHAR(50)  PRIMARY KEY,
    display_name     VARCHAR(100) NOT NULL,
    cron_expression  VARCHAR(100) NOT NULL,
    timezone         VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    last_run_at      TIMESTAMP,
    last_run_status  VARCHAR(20),
    last_run_message TEXT
);

INSERT INTO job_schedule_config (job_name, display_name, cron_expression) VALUES
    ('AUTO_INCOME',  'Auto Income (Dividends / Coupons / FD Maturity)', '0 0 20 * * *'),
    ('STOCK_PRICE',  'Stock Price Refresh',                              '0 */30 9-15 * * MON-FRI'),
    ('GOLD_PRICE',   'Gold Price Refresh',                               '0 0 10 * * *'),
    ('MF_NAV',       'Mutual Fund NAV Refresh',                          '0 30 21 * * MON-FRI');
