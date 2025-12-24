-- Migration: Update prices for INITIAL, COS, and TRANSFER products
-- Selection Process: $400 base + $150 per dependent
-- Scholarship: $900 base (no dependents)
-- I-20 Control: $900 base (no dependents)

-- Update INITIAL products
UPDATE visa_products
SET 
  base_price_usd = 400.00,
  extra_unit_price = 150.00,
  allow_extra_units = true,
  updated_at = NOW()
WHERE slug = 'initial-selection-process';

UPDATE visa_products
SET 
  base_price_usd = 900.00,
  extra_unit_price = 0.00,
  allow_extra_units = false,
  updated_at = NOW()
WHERE slug = 'initial-scholarship';

UPDATE visa_products
SET 
  base_price_usd = 900.00,
  extra_unit_price = 0.00,
  allow_extra_units = false,
  updated_at = NOW()
WHERE slug = 'initial-i20-control';

-- Update COS products
UPDATE visa_products
SET 
  base_price_usd = 400.00,
  extra_unit_price = 150.00,
  allow_extra_units = true,
  updated_at = NOW()
WHERE slug = 'cos-selection-process';

UPDATE visa_products
SET 
  base_price_usd = 900.00,
  extra_unit_price = 0.00,
  allow_extra_units = false,
  updated_at = NOW()
WHERE slug = 'cos-scholarship';

UPDATE visa_products
SET 
  base_price_usd = 900.00,
  extra_unit_price = 0.00,
  allow_extra_units = false,
  updated_at = NOW()
WHERE slug = 'cos-i20-control';

-- Update TRANSFER products
UPDATE visa_products
SET 
  base_price_usd = 400.00,
  extra_unit_price = 150.00,
  allow_extra_units = true,
  updated_at = NOW()
WHERE slug = 'transfer-selection-process';

UPDATE visa_products
SET 
  base_price_usd = 900.00,
  extra_unit_price = 0.00,
  allow_extra_units = false,
  updated_at = NOW()
WHERE slug = 'transfer-scholarship';

UPDATE visa_products
SET 
  base_price_usd = 900.00,
  extra_unit_price = 0.00,
  allow_extra_units = false,
  updated_at = NOW()
WHERE slug = 'transfer-i20-control';










