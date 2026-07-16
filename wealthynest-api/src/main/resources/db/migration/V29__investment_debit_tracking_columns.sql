-- Backfills three Investment columns that the entity has mapped and the service layer actively
-- reads/writes (investment-purchase debit tracking: which account/transfer funded a buy) but that
-- were never added via a committed Flyway migration — they exist only because they were added
-- directly against a live database out-of-band. Without this migration, ddl-auto: validate fails
-- Spring Boot startup on any environment that doesn't already have this exact manual drift
-- (fresh dev DB, CI, a new teammate's machine, production).
ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS debit_expense_id  UUID,
    ADD COLUMN IF NOT EXISTS debit_account_id  UUID,
    ADD COLUMN IF NOT EXISTS debit_transfer_id UUID;
