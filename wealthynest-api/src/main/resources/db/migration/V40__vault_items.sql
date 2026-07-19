-- Personal password-manager vault. Deliberately no family_id — vault items are
-- private to the owning user only, never shared within a family (unlike most
-- other domain tables). The secret (password or note body) is stored as
-- AES-256-GCM ciphertext + IV, encrypted/decrypted by VaultEncryptionService;
-- title/username/url/category stay plaintext to support list rendering and
-- search without decrypting every row. key_version is unused today but kept
-- from day one so a future master-key rotation doesn't need a retrofit.

CREATE TABLE vault_items (
    id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id             UUID          NOT NULL REFERENCES users(id),
    item_type           VARCHAR(20)   NOT NULL,
    title               VARCHAR(150)  NOT NULL,
    username            VARCHAR(150),
    url                 VARCHAR(500),
    category            VARCHAR(50),
    secret_ciphertext   TEXT          NOT NULL,
    secret_iv           TEXT          NOT NULL,
    key_version         INTEGER       DEFAULT 1 NOT NULL,
    favorite            BOOLEAN       DEFAULT false NOT NULL,
    last_revealed_at    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   DEFAULT now() NOT NULL,
    updated_at          TIMESTAMPTZ   DEFAULT now() NOT NULL,
    created_by          UUID,
    modified_by         UUID,
    CONSTRAINT vault_items_item_type_check CHECK (item_type IN ('LOGIN', 'SECURE_NOTE'))
);

CREATE INDEX idx_vault_items_user           ON vault_items (user_id);
CREATE INDEX idx_vault_items_user_favorite  ON vault_items (user_id, favorite);
