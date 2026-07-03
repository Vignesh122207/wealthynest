CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL,
    year         INTEGER NOT NULL,
    month        INTEGER NOT NULL,
    net_worth    NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_nw_snapshot_user ON net_worth_snapshots (user_id, year, month);
