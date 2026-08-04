-- One-time cleanup for duplicates that already exist from before V55 introduced session_id:
-- V54's grace-window race minted a brand-new, unrelated refresh_tokens row every time it fired,
-- so devices that hit that race repeatedly (e.g. a browser tab reloading while the dashboard's
-- own profile resync races it) had accumulated several currently-active rows for what is really
-- one login. V55's backfill gave each of those pre-existing rows its own distinct session_id
-- (there was no lineage to recover), so they'd otherwise keep showing as separate entries in the
-- Active Sessions list until each one individually expires. Collapse them now: for currently
-- active rows, anything sharing (user_id, ip_address, user_agent) is, by the app's own definition
-- of "device" in this feature, the same session — give the whole group the same session_id so
-- listSessions immediately shows one entry instead of several.
-- uuid has no MIN() aggregate in Postgres (only a btree ordering operator), hence
-- first_value()/ORDER BY here instead of MIN() OVER (...).
WITH groups AS (
    SELECT id,
           first_value(id) OVER (PARTITION BY user_id, ip_address, user_agent ORDER BY id) AS canonical_id
    FROM refresh_tokens
    WHERE revoked = false AND expires_at > now()
)
UPDATE refresh_tokens rt
SET session_id = groups.canonical_id
FROM groups
WHERE rt.id = groups.id
  AND rt.id <> groups.canonical_id;
