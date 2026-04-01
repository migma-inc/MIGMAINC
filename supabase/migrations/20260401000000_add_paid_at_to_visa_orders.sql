-- Add paid_at column to visa_orders
-- This stores the actual payment confirmation date, as opposed to created_at
-- which only records when the order record was created.
-- paid_at is used for commission month attribution and analytics date grouping.

ALTER TABLE visa_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill from payment_metadata.completed_at for existing completed orders
UPDATE visa_orders
SET paid_at = (payment_metadata->>'completed_at')::TIMESTAMPTZ
WHERE payment_status = 'completed'
  AND payment_metadata->>'completed_at' IS NOT NULL
  AND paid_at IS NULL;

-- Fallback: for completed orders without completed_at in metadata, use created_at
UPDATE visa_orders
SET paid_at = created_at
WHERE payment_status = 'completed'
  AND paid_at IS NULL;
