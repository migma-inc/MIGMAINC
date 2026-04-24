-- Migration: Add placement_fee source and application_id to split_payments
-- Allows PlacementFeeStep to use split payment (Parcelow) without visa_orders FK

-- 1. Expand source check constraint to include placement_fee
ALTER TABLE split_payments DROP CONSTRAINT IF EXISTS split_payments_source_check;
ALTER TABLE split_payments ADD CONSTRAINT split_payments_source_check
  CHECK (source IN ('visa', 'migma', 'placement_fee'));

-- 2. Add application_id FK (used when source = 'placement_fee')
ALTER TABLE split_payments
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES institution_applications(id);

-- 3. Index for application_id lookups
CREATE INDEX IF NOT EXISTS idx_split_payments_application_id
  ON split_payments(application_id)
  WHERE application_id IS NOT NULL;
