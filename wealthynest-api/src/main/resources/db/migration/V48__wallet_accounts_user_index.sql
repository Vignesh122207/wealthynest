-- wallet_accounts had no plain index on user_id — only the two partial unique indexes scoped to
-- specific account_type values. Every "list my accounts" call, balance-enrichment batch, and
-- scheduler sweep filters on this column, so it needs its own index.

CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user ON wallet_accounts (user_id);
