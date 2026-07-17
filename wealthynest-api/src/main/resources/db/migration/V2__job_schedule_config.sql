-- Cron configuration for JobSchedulerService's custom dispatcher — one row per background job.

CREATE TABLE job_schedule_config (
    job_name         VARCHAR(50)  PRIMARY KEY,
    display_name     VARCHAR(100) NOT NULL,
    cron_expression  VARCHAR(100) NOT NULL,
    timezone         VARCHAR(50)  DEFAULT 'Asia/Kolkata' NOT NULL,
    enabled          BOOLEAN      DEFAULT true NOT NULL,
    last_run_at      TIMESTAMP,
    last_run_status  VARCHAR(20),
    last_run_message TEXT
);
