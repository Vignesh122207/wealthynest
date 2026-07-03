-- Debt Tracker: money lent to others (LENT) or borrowed from others (BORROWED)

CREATE TABLE IF NOT EXISTS debt_records (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(10)   NOT NULL CHECK (type IN ('LENT', 'BORROWED')),
    contact_name    VARCHAR(100)  NOT NULL,
    contact_phone   VARCHAR(20),
    amount          NUMERIC(15,2) NOT NULL,
    description     VARCHAR(255),
    due_date        DATE,
    status          VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SETTLED', 'PARTIAL')),
    amount_settled  NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debt_payments (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id         UUID          NOT NULL REFERENCES debt_records(id) ON DELETE CASCADE,
    amount          NUMERIC(15,2) NOT NULL,
    note            VARCHAR(255),
    paid_at         TIMESTAMP     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debt_records_user   ON debt_records (user_id, status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt  ON debt_payments (debt_id);
