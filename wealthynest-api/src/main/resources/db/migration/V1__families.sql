-- Family groups — the unit most data (accounts, assets, budgets, categories) is scoped to.

CREATE TABLE families (
    id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    invite_code VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    updated_at  TIMESTAMPTZ  DEFAULT now() NOT NULL,
    created_by  UUID,
    modified_by UUID,
    CONSTRAINT families_invite_code_key UNIQUE (invite_code)
);
