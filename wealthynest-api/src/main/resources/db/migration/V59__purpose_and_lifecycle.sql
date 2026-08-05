-- Purpose/lifecycle redesign: EMERGENCY_FUND and INVESTMENT retire as account types and become an
-- optional `purpose` tag (also assignable to investments); archived/is_active booleans become a
-- three-state lifecycle (ACTIVE/CLOSED/ARCHIVED); investments stop mandatorily owning an Asset row.

-- ── wallet_accounts ──────────────────────────────────────────────────────────

ALTER TABLE wallet_accounts ADD COLUMN purpose       VARCHAR(30);
ALTER TABLE wallet_accounts ADD COLUMN purpose_label VARCHAR(100);
ALTER TABLE wallet_accounts ADD COLUMN status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';

UPDATE wallet_accounts SET status = CASE WHEN archived THEN 'ARCHIVED' ELSE 'ACTIVE' END;

-- EMERGENCY_FUND/INVESTMENT were never structurally different from BANK_ACCOUNT (same balance
-- formula, no dedicated fields) — fold them into BANK_ACCOUNT with the equivalent purpose tag.
UPDATE wallet_accounts SET purpose = 'EMERGENCY_FUND', account_type = 'BANK_ACCOUNT' WHERE account_type = 'EMERGENCY_FUND';
UPDATE wallet_accounts SET purpose = 'INVESTMENT',     account_type = 'BANK_ACCOUNT' WHERE account_type = 'INVESTMENT';

ALTER TABLE wallet_accounts DROP COLUMN archived;

ALTER TABLE wallet_accounts DROP CONSTRAINT wallet_accounts_account_type_check;
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_account_type_check
    CHECK (account_type IN ('CASH_WALLET', 'BANK_ACCOUNT', 'CREDIT_CARD', 'LOAN'));

ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_purpose_check
    CHECK (purpose IS NULL OR purpose IN (
        'EMERGENCY_FUND', 'RETIREMENT', 'EDUCATION', 'HOUSE_PURCHASE', 'VEHICLE_PURCHASE',
        'VACATION', 'CHILD_FUTURE', 'TAX_SAVINGS', 'INVESTMENT', 'GENERAL_SAVINGS', 'CUSTOM'));
-- Purpose is Bank-Account-only among account types (never Cash Wallet, Credit Card, or Loan).
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_purpose_scope_check
    CHECK (purpose IS NULL OR account_type = 'BANK_ACCOUNT');
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_status_check
    CHECK (status IN ('ACTIVE', 'CLOSED', 'ARCHIVED'));

-- Singleton constraint on EMERGENCY_FUND retires along with the account type — a purpose is a
-- many-to-one tag by nature, and the user's own examples already assume multiple tagged rows.
DROP INDEX wa_unique_emergeny;

-- ── investments ──────────────────────────────────────────────────────────────

ALTER TABLE investments ADD COLUMN purpose       VARCHAR(30);
ALTER TABLE investments ADD COLUMN purpose_label VARCHAR(100);
ALTER TABLE investments ADD COLUMN broker        VARCHAR(50);
ALTER TABLE investments ADD COLUMN status        VARCHAR(10) NOT NULL DEFAULT 'ACTIVE';

-- Can't retroactively tell "fully sold" apart from "user archived" for historical rows (both
-- collapsed into is_active=false) — accepted gap; only future deactivations get the CLOSED
-- distinction (see InvestmentServiceImpl.recalculateStockTotals / deleteInvestment).
UPDATE investments SET status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'ARCHIVED' END;

-- Every investment forced a shadow Asset row for net-worth rollup purposes that nothing actually
-- reads anymore (net worth sums Investment.current_value directly) — soft-archive those shadow
-- rows before the link disappears rather than leaving them active-but-orphaned.
UPDATE assets SET is_active = false WHERE id IN (SELECT asset_id FROM investments WHERE asset_id IS NOT NULL);

-- DROP COLUMN cascades: Postgres automatically drops the single-column FK constraint and the
-- single-column index (idx_investments_asset) that depend solely on asset_id, no explicit
-- DROP CONSTRAINT/DROP INDEX needed (and safer than guessing the FK's auto-generated name).
ALTER TABLE investments DROP COLUMN asset_id;
ALTER TABLE investments DROP COLUMN debit_expense_id;
ALTER TABLE investments DROP COLUMN is_active;

ALTER TABLE investments ADD CONSTRAINT investments_purpose_check
    CHECK (purpose IS NULL OR purpose IN (
        'EMERGENCY_FUND', 'RETIREMENT', 'EDUCATION', 'HOUSE_PURCHASE', 'VEHICLE_PURCHASE',
        'VACATION', 'CHILD_FUTURE', 'TAX_SAVINGS', 'INVESTMENT', 'GENERAL_SAVINGS', 'CUSTOM'));
ALTER TABLE investments ADD CONSTRAINT investments_status_check
    CHECK (status IN ('ACTIVE', 'CLOSED', 'ARCHIVED'));
