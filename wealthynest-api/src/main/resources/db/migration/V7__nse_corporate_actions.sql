-- Dividend/corporate-action calendar per NSE symbol — drives the dividend-suggestion feature in
-- InvestmentServiceImpl (auto-suggesting a logIncome() entry when a held stock goes ex-dividend).

CREATE TABLE nse_corporate_actions (
    id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    symbol              VARCHAR(30) NOT NULL,
    action_type         VARCHAR(20) DEFAULT 'DIVIDEND' NOT NULL,
    ex_date             DATE        NOT NULL,
    record_date         DATE,
    dividend_per_share  NUMERIC(10,4),
    created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_corp_action UNIQUE (symbol, action_type, ex_date)
);

CREATE INDEX idx_corp_actions_symbol ON nse_corporate_actions (symbol, ex_date DESC);
