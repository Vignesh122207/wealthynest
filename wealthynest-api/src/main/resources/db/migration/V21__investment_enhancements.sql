-- V10: Investment enhancements — TDS rate, brokerage, dismissed dividends, BSE stock master

-- TDS rate for bonds (% applied to coupon, e.g. 10 = 10% TDS → net coupon = gross * 0.90)
ALTER TABLE investments ADD COLUMN IF NOT EXISTS tds_rate NUMERIC(5,2) DEFAULT 0;

-- Brokerage paid when buying a stock/instrument (added to the debit amount, not to investedAmount)
ALTER TABLE investments ADD COLUMN IF NOT EXISTS brokerage NUMERIC(14,2) DEFAULT 0;

-- Track user-dismissed dividend suggestions so they don't reappear
CREATE TABLE IF NOT EXISTS dismissed_dividends (
    id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id        UUID         NOT NULL,
    investment_id  UUID         NOT NULL,
    ex_date        DATE         NOT NULL,
    dismissed_at   TIMESTAMPTZ  DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dismissed_div
    ON dismissed_dividends (user_id, investment_id, ex_date);
CREATE INDEX IF NOT EXISTS idx_dismissed_div_user
    ON dismissed_dividends (user_id);

-- Stock transactions (buy / sell for individual stock positions)
CREATE TABLE IF NOT EXISTS stock_transactions (
    id               BIGSERIAL    PRIMARY KEY,
    investment_id    UUID         NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    transaction_date DATE         NOT NULL,
    transaction_type VARCHAR(10)  NOT NULL DEFAULT 'BUY',   -- BUY or SELL
    quantity         NUMERIC(14,4) NOT NULL,
    price_per_share  NUMERIC(14,4) NOT NULL,
    brokerage        NUMERIC(14,2) DEFAULT 0,
    notes            VARCHAR(500),
    created_at       TIMESTAMPTZ  DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_txn_investment ON stock_transactions (investment_id);
