-- Adds 5 day-to-day purpose tags (Wedding, Medical, Debt Payoff, Home Renovation, Daily
-- Spending) alongside the original 10 + Custom from V59 — same purely-descriptive tag, no
-- balance/net-worth math depends on the value, so this is additive only.

ALTER TABLE wallet_accounts DROP CONSTRAINT wallet_accounts_purpose_check;
ALTER TABLE wallet_accounts ADD CONSTRAINT wallet_accounts_purpose_check
    CHECK (purpose IS NULL OR purpose IN (
        'EMERGENCY_FUND', 'RETIREMENT', 'EDUCATION', 'HOUSE_PURCHASE', 'VEHICLE_PURCHASE',
        'VACATION', 'CHILD_FUTURE', 'TAX_SAVINGS', 'INVESTMENT', 'GENERAL_SAVINGS',
        'WEDDING', 'MEDICAL', 'DEBT_PAYOFF', 'HOME_RENOVATION', 'DAILY_SPENDING', 'CUSTOM'));

ALTER TABLE investments DROP CONSTRAINT investments_purpose_check;
ALTER TABLE investments ADD CONSTRAINT investments_purpose_check
    CHECK (purpose IS NULL OR purpose IN (
        'EMERGENCY_FUND', 'RETIREMENT', 'EDUCATION', 'HOUSE_PURCHASE', 'VEHICLE_PURCHASE',
        'VACATION', 'CHILD_FUTURE', 'TAX_SAVINGS', 'INVESTMENT', 'GENERAL_SAVINGS',
        'WEDDING', 'MEDICAL', 'DEBT_PAYOFF', 'HOME_RENOVATION', 'DAILY_SPENDING', 'CUSTOM'));
