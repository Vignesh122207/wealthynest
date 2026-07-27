-- Per-user opt-out for the new SIP-upcoming reminder, same convention as V45's other alert toggles.
ALTER TABLE notification_preferences ADD COLUMN sip_reminder_enabled BOOLEAN DEFAULT true NOT NULL;

-- Registers the SIP_REMINDER job so it's actually scheduled — see V47's own comment for why this
-- matters: a job wired into JobSchedulerService's dispatcher with no row here never runs.
INSERT INTO job_schedule_config (job_name, display_name, cron_expression, timezone, enabled)
VALUES ('SIP_REMINDER', 'SIP Reminder (heads-up before the SIP day)', '0 0 8 * * *', 'Asia/Kolkata', true)
ON CONFLICT (job_name) DO NOTHING;
