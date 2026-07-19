-- The real dividend/bond-coupon/FD-maturity income ledger (InvestmentServiceImpl.logIncome()) —
-- each row optionally links to the income_entries row it credited to the user's cash flow.
-- uq_inv_income_log prevents double-crediting the same investment for the same event twice.

CREATE TABLE investment_income_log (
    id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    investment_id    UUID          NOT NULL REFERENCES investments(id),
    user_id          UUID          NOT NULL REFERENCES users(id),
    income_entry_id  UUID          REFERENCES income_entries(id) ON DELETE SET NULL,
    income_type      VARCHAR(20)   NOT NULL,
    event_date       DATE          NOT NULL,
    amount           NUMERIC(14,2) NOT NULL,
    created_at       TIMESTAMPTZ   DEFAULT now() NOT NULL,
    CONSTRAINT uq_inv_income_log UNIQUE (investment_id, income_type, event_date)
);

CREATE INDEX idx_inv_income_log_user          ON investment_income_log (user_id);
CREATE INDEX idx_inv_income_log_income_entry  ON investment_income_log (income_entry_id);
