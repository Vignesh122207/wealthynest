-- Opt-in per-transaction location capture (Tier 1: raw coordinates only, no reverse geocoding,
-- no embedded map). Both nullable — the vast majority of existing/future expenses never set
-- these, captured only when the user explicitly taps "Add current location" in the expense form.

ALTER TABLE expenses ADD COLUMN latitude  DOUBLE PRECISION;
ALTER TABLE expenses ADD COLUMN longitude DOUBLE PRECISION;

ALTER TABLE expenses ADD CONSTRAINT expenses_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90);
ALTER TABLE expenses ADD CONSTRAINT expenses_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
