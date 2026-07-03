-- Store whether the user chose "remember me" so token refresh honours the original session length
ALTER TABLE refresh_tokens ADD COLUMN remember_me BOOLEAN NOT NULL DEFAULT true;
