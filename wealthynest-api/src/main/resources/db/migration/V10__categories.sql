-- Expense/income/transfer categories. Personal (user_id set) or family-shared (family_id set) or
-- system-seeded (is_system, both null) — never more than one of user/family scoping at a time.
-- archived is a soft-delete: expenses keep pointing at an archived category so history/reports
-- still resolve a name, and createCategory can revive one with a matching name instead of
-- duplicating (see CategoryRepository.findArchivedForRevive).

CREATE TABLE categories (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id   UUID         REFERENCES families(id) ON DELETE CASCADE,
    user_id     UUID         REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(80)  NOT NULL,
    icon        VARCHAR(50),
    color       VARCHAR(7),
    type        VARCHAR(20)  NOT NULL,
    is_system   BOOLEAN      DEFAULT false NOT NULL,
    archived    BOOLEAN      DEFAULT false NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    created_by  UUID,
    modified_by UUID,
    CONSTRAINT categories_type_check CHECK (type IN ('EXPENSE', 'INCOME', 'TRANSFER')),
    -- Deferred so a rename/swap within one transaction doesn't trip a false mid-transaction violation.
    CONSTRAINT uq_categories_name_type_system UNIQUE (name, type, is_system) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_categories_user_id ON categories (user_id);
CREATE INDEX idx_categories_family  ON categories (family_id);
