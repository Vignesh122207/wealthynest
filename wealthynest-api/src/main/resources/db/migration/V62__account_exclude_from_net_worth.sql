-- Per-account opt-out of net worth totals — for a joint account, a company-reimbursed card, or
-- anything else a user tracks in-app but doesn't want counted toward their personal net worth.
-- Defaults false so every existing account keeps counting exactly as it does today.

ALTER TABLE wallet_accounts ADD COLUMN exclude_from_net_worth BOOLEAN NOT NULL DEFAULT FALSE;
