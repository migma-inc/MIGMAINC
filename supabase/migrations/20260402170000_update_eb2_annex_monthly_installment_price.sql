-- Update EB-2 Monthly Installment (Annex) product base price to US$ 999.00
-- This product should not allow dependents

UPDATE visa_products
SET
  base_price_usd = 999.00,
  allow_extra_units = false,
  extra_unit_price = 0.00
WHERE slug = 'eb2-annex-installment'
   OR name ILIKE '%EB-2%Monthly Installment%Annex%';
