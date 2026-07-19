-- Local mirror of mfapi.in's full mutual fund scheme list, so MF search queries Postgres instead
-- of live-proxying to a third-party API on every keystroke (the root cause of slow MF search —
-- stock search already solved this exact problem via stock_master). Kept current by
-- MfMasterSyncScheduler. pg_trgm backs substring search at this table's scale (tens of thousands
-- of rows, ~20x stock_master) where a plain btree index would only help prefix matches.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE mf_master (
    scheme_code  VARCHAR(20)  PRIMARY KEY,
    scheme_name  VARCHAR(500) NOT NULL,
    updated_at   TIMESTAMPTZ  DEFAULT now() NOT NULL
);

-- Expression index matching MfMasterRepository.search()'s LOWER(scheme_name) LIKE '%q%' exactly —
-- a plain (non-expression) trigram index on scheme_name wouldn't be used by a query that wraps
-- the column in LOWER() first, since Postgres matches expression indexes to identical expressions.
CREATE INDEX idx_mf_master_name_trgm ON mf_master USING gin (LOWER(scheme_name) gin_trgm_ops);
