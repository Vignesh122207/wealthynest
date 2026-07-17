-- Individual repayments against a debt_records row (partial or full settlement history).

CREATE TABLE debt_payments (
    id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id           UUID          NOT NULL REFERENCES debt_records(id) ON DELETE CASCADE,
    amount            NUMERIC(15,2) NOT NULL,
    note              VARCHAR(255),
    linked_entry_id   UUID,
    paid_at           TIMESTAMP     DEFAULT now() NOT NULL
);

CREATE INDEX idx_debt_payments_debt ON debt_payments (debt_id);
