-- Migration: Create 9 products for INITIAL, COS, and TRANSFER services
-- Each service has 3 sub-services: selection-process, scholarship, i20-control

-- INITIAL Products
INSERT INTO visa_products (
  slug,
  name,
  description,
  base_price_usd,
  extra_unit_price,
  extra_unit_label,
  calculation_type,
  allow_extra_units,
  is_active,
  created_at,
  updated_at
) VALUES
  (
    'initial-selection-process',
    'U.S. Visa - Initial Application - Selection Process',
    'Selection process service for initial U.S. visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'initial-scholarship',
    'U.S. Visa - Initial Application - Scholarship',
    'Scholarship service for initial U.S. visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'initial-i20-control',
    'U.S. Visa - Initial Application - I-20 Control',
    'I-20 control service for initial U.S. visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  -- COS (Change of Status) Products
  (
    'cos-selection-process',
    'U.S. Visa - Change of Status - Selection Process',
    'Selection process service for change of status visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'cos-scholarship',
    'U.S. Visa - Change of Status - Scholarship',
    'Scholarship service for change of status visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'cos-i20-control',
    'U.S. Visa - Change of Status - I-20 Control',
    'I-20 control service for change of status visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  -- TRANSFER Products
  (
    'transfer-selection-process',
    'U.S. Visa - Transfer - Selection Process',
    'Selection process service for transfer visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'transfer-scholarship',
    'U.S. Visa - Transfer - Scholarship',
    'Scholarship service for transfer visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'transfer-i20-control',
    'U.S. Visa - Transfer - I-20 Control',
    'I-20 control service for transfer visa application',
    999.00,
    150.00,
    'Number of dependents',
    'base_plus_units',
    true,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (slug) DO NOTHING;











