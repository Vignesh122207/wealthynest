-- Captures how many shares/units the investment actually held at the moment this income event
-- was logged. The frontend already sends this on every log-income call (see
-- DividendSuggestionsSection.tsx: `shares: s.sharesHeld`), and getIncomeHistory has always divided
-- by the investment's *current* unit count to display a per-share amount instead — correct only
-- until the user buys or sells more of that holding, after which every past record's displayed
-- per-share figure silently drifts from what was actually true at the time. Nullable: existing
-- rows have no historical value to backfill, and getIncomeHistory falls back to the old
-- current-units approximation only when this is null (see InvestmentServiceImpl).
ALTER TABLE investment_income_log ADD COLUMN shares_held NUMERIC(18, 4);
