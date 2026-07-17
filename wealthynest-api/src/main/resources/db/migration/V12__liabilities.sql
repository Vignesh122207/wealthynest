-- Money owed (loans, credit cards tracked as liabilities) — separate from Investment/Asset, with
-- its own repayment/due-date fields. Distinct from wallet_accounts' LOAN/CREDIT_CARD account
-- types, which model the same concept as a spendable/payable account instead of a static balance.

CREATE TABLE liabilities (
    id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID          NOT NULL REFERENCES users(id),
    family_id           UUID          REFERENCES families(id),
    name                VARCHAR(100)  NOT NULL,
    liability_type      VARCHAR(30)   NOT NULL,
    principal_amount    NUMERIC(16,2) DEFAULT 0 NOT NULL,
    outstanding_amount  NUMERIC(16,2) DEFAULT 0 NOT NULL,
    interest_rate       NUMERIC(5,2),
    lender_name         VARCHAR(100),
    emi_amount          NUMERIC(14,2),
    start_date          DATE,
    end_date            DATE,
    notes               TEXT,
    is_active           BOOLEAN       DEFAULT true NOT NULL,
    created_at          TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at          TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by          UUID,
    modified_by         UUID,
    CONSTRAINT liabilities_liability_type_check CHECK (liability_type IN (
        'HOME_LOAN', 'CAR_LOAN', 'PERSONAL_LOAN', 'CREDIT_CARD', 'EDUCATION_LOAN', 'GOLD_LOAN',
        'BUSINESS_LOAN', 'OTHER'))
);

CREATE INDEX idx_liabilities_user   ON liabilities (user_id);
CREATE INDEX idx_liabilities_family ON liabilities (family_id);
