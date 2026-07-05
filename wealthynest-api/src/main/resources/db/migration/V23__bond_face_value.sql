-- Bond face value (par value per bond, e.g. ₹1000 for most Indian bonds).
-- Coupon income and maturity principal are calculated on face value × units,
-- not on the purchase price (avg_buy_price), which may differ when bought at discount/premium.
-- Default to avg_buy_price for existing records so behaviour is unchanged.
ALTER TABLE investments
    ADD COLUMN IF NOT EXISTS face_value NUMERIC(14,4);

UPDATE investments
   SET face_value = avg_buy_price
 WHERE investment_type = 'BOND'
   AND face_value IS NULL
   AND avg_buy_price IS NOT NULL;
