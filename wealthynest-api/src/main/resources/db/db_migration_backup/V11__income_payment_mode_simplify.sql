-- Remap any UPI/CHEQUE entries to BANK_ACCOUNT before tightening constraint
UPDATE income_entries SET payment_mode = 'BANK_ACCOUNT' WHERE payment_mode IN ('UPI', 'CHEQUE');

-- Replace check constraint to allow only CASH and BANK_ACCOUNT
ALTER TABLE income_entries DROP CONSTRAINT IF EXISTS income_entries_payment_mode_check;
ALTER TABLE income_entries ADD CONSTRAINT income_entries_payment_mode_check
    CHECK (payment_mode IN ('CASH', 'BANK_ACCOUNT'));
