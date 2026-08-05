-- Vault Health (weak/breached/reused) was mistakenly computed for SECURE_NOTE items too — a
-- note's content isn't a credential, so scoring/breach-checking/reuse-hashing it was meaningless
-- and actively misleading (ordinary prose reads as "weak" just for lacking digits/symbols, and two
-- notes sharing text got falsely flagged "Reused"). The application code now only computes these
-- fields for LOGIN items; this clears the stale values already persisted for existing notes. No
-- decryption needed — these are just derived metadata columns, not the encrypted secret itself.
UPDATE vault_items SET secret_hash = NULL, strength_level = NULL, breach_count = NULL
WHERE item_type = 'SECURE_NOTE';
