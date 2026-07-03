ALTER TABLE income_entries
    ADD COLUMN payment_mode VARCHAR(20) NOT NULL DEFAULT 'BANK_ACCOUNT'
        CHECK (payment_mode IN ('CASH','BANK_ACCOUNT','UPI','CHEQUE'));
