-- Migration: Add migma split payment support to split_payments table
-- Allows MigmaCheckout students to use split payment without visa_orders FK

-- 1. Make order_id nullable (migma rows don't have a visa_orders FK)
ALTER TABLE split_payments ALTER COLUMN order_id DROP NOT NULL;

-- 2. Add migma user id (join key used by webhook to call migma-payment-completed)
ALTER TABLE split_payments
  ADD COLUMN IF NOT EXISTS migma_user_id UUID REFERENCES auth.users(id);

-- 3. Add source discriminator for routing webhook and redirect page
ALTER TABLE split_payments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'visa'
    CHECK (source IN ('visa', 'migma'));

-- 4. Add migma service type (needed to rebuild success URL after fully_completed)
ALTER TABLE split_payments
  ADD COLUMN IF NOT EXISTS migma_service_type TEXT;

-- 5. Index for migma user lookups
CREATE INDEX IF NOT EXISTS idx_split_payments_migma_user_id
  ON split_payments(migma_user_id)
  WHERE migma_user_id IS NOT NULL;

-- 6. RLS: authenticated students can read their own migma split payment
CREATE POLICY "Students can read own migma split"
  ON split_payments
  FOR SELECT
  TO authenticated
  USING (migma_user_id = auth.uid());
