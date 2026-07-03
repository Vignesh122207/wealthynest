-- Replace Yahoo Finance stock price job with NSE End-of-Day job.
-- NSE_EOD downloads bhavcopy (closing prices) + daily corporate actions (dividends)
-- once per day after market close at 6 PM IST — no rate limits, official source.

DELETE FROM job_schedule_config WHERE job_name = 'STOCK_PRICE';

INSERT INTO job_schedule_config (job_name, display_name, cron_expression, timezone)
VALUES ('NSE_EOD', 'NSE End-of-Day (Stock Prices + Dividends)', '0 0 18 * * MON-FRI', 'Asia/Kolkata')
ON CONFLICT (job_name) DO UPDATE
    SET display_name    = EXCLUDED.display_name,
        cron_expression = EXCLUDED.cron_expression;
