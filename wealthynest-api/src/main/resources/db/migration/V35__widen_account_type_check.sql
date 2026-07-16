-- V32 added LOAN and INVESTMENT as account types (plus their supporting columns) but never widened
-- this CHECK constraint from V3, so every insert of those two types was silently rejected at the
-- database layer regardless of what the application code allowed.
ALTER TABLE wallet_accounts DROP CONSTRAINT wallet_accounts_account_type_check;
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_account_type_check
    CHECK (account_type IN ('CASH_WALLET', 'BANK_ACCOUNT', 'EMERGENCY_FUND', 'CREDIT_CARD', 'LOAN', 'INVESTMENT'));
