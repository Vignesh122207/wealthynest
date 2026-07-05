-- Index for fast bulk price updates: UPDATE investments WHERE symbol = ? AND is_active = true
CREATE INDEX IF NOT EXISTS idx_investments_symbol_active
    ON investments (symbol, is_active)
    WHERE is_active = true;
