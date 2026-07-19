-- Optional user-picked icon key (resolved to a lucide glyph client-side, same pattern as
-- goals.icon) — falls back to a type-derived icon (LOGIN/SECURE_NOTE) when null.
ALTER TABLE vault_items ADD COLUMN icon VARCHAR(30);
