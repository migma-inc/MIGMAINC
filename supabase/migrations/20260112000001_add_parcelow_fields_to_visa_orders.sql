-- Migration: Add Parcelow payment fields to visa_orders table
-- This migration adds support for Parcelow as a payment method in the checkout

-- Add Parcelow-specific fields to visa_orders
ALTER TABLE visa_orders
  ADD COLUMN IF NOT EXISTS parcelow_order_id TEXT,
  ADD COLUMN IF NOT EXISTS parcelow_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS parcelow_status TEXT,
  ADD COLUMN IF NOT EXISTS parcelow_status_code INTEGER;

-- Add comment to payment_method column to document Parcelow option
COMMENT ON COLUMN visa_orders.payment_method IS 'Payment method: stripe_card, stripe_pix, zelle, wise, or parcelow';

-- Add comments to new fields
COMMENT ON COLUMN visa_orders.parcelow_order_id IS 'Parcelow order ID from Parcelow API';
COMMENT ON COLUMN visa_orders.parcelow_checkout_url IS 'Parcelow checkout URL for redirect';
COMMENT ON COLUMN visa_orders.parcelow_status IS 'Parcelow-specific payment status (Open, Paid, Declined, etc.)';
COMMENT ON COLUMN visa_orders.parcelow_status_code IS 'Parcelow status code (0 = Open, etc.)';

-- Create index on parcelow_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_visa_orders_parcelow_order_id ON visa_orders(parcelow_order_id);
