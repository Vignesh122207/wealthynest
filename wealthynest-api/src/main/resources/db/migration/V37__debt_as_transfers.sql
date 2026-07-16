-- Debts move off the Expense/Income tables onto AccountTransfer. A debt is money leaving or
-- entering your control, not spending or earning — Transfer already supports one-sided (external)
-- rows for exactly this shape, via the same mechanism balance adjustments use.
ALTER TABLE account_transfers ADD COLUMN IF NOT EXISTS is_debt           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE account_transfers ADD COLUMN IF NOT EXISTS debt_contact_name VARCHAR(255);
ALTER TABLE account_transfers ADD COLUMN IF NOT EXISTS debt_label        VARCHAR(20);

ALTER TABLE debt_records ADD COLUMN IF NOT EXISTS linked_transfer_id UUID;

-- Migrate existing debt-linked expense/income rows into debt-tagged transfers, backfilling
-- contact name/label from debt_records itself (some of these predate those columns existing).
DO $$
DECLARE
    r RECORD;
    new_id UUID;
BEGIN
    FOR r IN
        SELECT dr.id AS debt_id, dr.contact_name, dr.account_id, dr.user_id,
               e.id AS expense_id, e.amount, e.description, e.expense_date, e.created_at
        FROM debt_records dr
        JOIN expenses e ON e.id = dr.linked_expense_id
        WHERE dr.linked_expense_id IS NOT NULL
    LOOP
        INSERT INTO account_transfers (id, user_id, from_account_id, to_account_id, amount, description,
                                        is_debt, debt_contact_name, debt_label, transfer_date, created_at)
        VALUES (gen_random_uuid(), r.user_id, r.account_id, NULL, r.amount, r.description,
                true, r.contact_name, 'LENT', r.expense_date, r.created_at)
        RETURNING id INTO new_id;

        UPDATE debt_records SET linked_transfer_id = new_id WHERE id = r.debt_id;
        DELETE FROM expenses WHERE id = r.expense_id;
    END LOOP;

    FOR r IN
        SELECT dr.id AS debt_id, dr.contact_name, dr.account_id, dr.user_id,
               i.id AS income_id, i.amount, i.description, i.income_date, i.created_at
        FROM debt_records dr
        JOIN income_entries i ON i.id = dr.linked_income_id
        WHERE dr.linked_income_id IS NOT NULL
    LOOP
        INSERT INTO account_transfers (id, user_id, from_account_id, to_account_id, amount, description,
                                        is_debt, debt_contact_name, debt_label, transfer_date, created_at)
        VALUES (gen_random_uuid(), r.user_id, NULL, r.account_id, r.amount, r.description,
                true, r.contact_name, 'BORROWED', r.income_date, r.created_at)
        RETURNING id INTO new_id;

        UPDATE debt_records SET linked_transfer_id = new_id WHERE id = r.debt_id;
        DELETE FROM income_entries WHERE id = r.income_id;
    END LOOP;
END $$;

ALTER TABLE debt_records DROP COLUMN IF EXISTS linked_expense_id;
ALTER TABLE debt_records DROP COLUMN IF EXISTS linked_income_id;

-- debt_contact_name/debt_label on expenses/income_entries are now write-once dead columns —
-- nothing will set is_debt=true on these tables again.
ALTER TABLE expenses       DROP COLUMN IF EXISTS debt_contact_name;
ALTER TABLE expenses       DROP COLUMN IF EXISTS debt_label;
ALTER TABLE income_entries DROP COLUMN IF EXISTS debt_contact_name;
ALTER TABLE income_entries DROP COLUMN IF EXISTS debt_label;
