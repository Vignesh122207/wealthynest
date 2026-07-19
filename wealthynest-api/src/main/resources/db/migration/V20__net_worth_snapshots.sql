-- Monthly point-in-time net worth rollups, used for the net-worth trend chart
-- (NetWorthSnapshotScheduler.takeMonthlySnapshots(), one row per user per month).

CREATE TABLE net_worth_snapshots (
    id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year        INTEGER       NOT NULL,
    month       INTEGER       NOT NULL,
    net_worth   NUMERIC(18,2) DEFAULT 0 NOT NULL,
    created_at  TIMESTAMP     DEFAULT now() NOT NULL,
    CONSTRAINT net_worth_snapshots_user_id_year_month_key UNIQUE (user_id, year, month)
);

CREATE INDEX idx_nw_snapshot_user ON net_worth_snapshots (user_id, year, month);
