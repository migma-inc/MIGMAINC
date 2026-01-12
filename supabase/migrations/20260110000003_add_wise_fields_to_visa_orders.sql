-- Migration: Add Wise payment fields to visa_orders table
-- This migration adds support for Wise as a payment method in the checkout

-- Add Wise-specific fields to visa_orders
ALTER TABLE visa_orders
  ADD COLUMN IF NOT EXISTS wise_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS wise_quote_uuid TEXT,
  ADD COLUMN IF NOT EXISTS wise_recipient_id TEXT,
  ADD COLUMN IF NOT EXISTS wise_payment_status TEXT;

-- Add comment to payment_method column to document Wise option
COMMENT ON COLUMN visa_orders.payment_method IS 'Payment method: stripe_card, stripe_pix, zelle, or wise';

-- Add comment to new fields
COMMENT ON COLUMN visa_orders.wise_transfer_id IS 'Wise transfer ID from Wise API';
COMMENT ON COLUMN visa_orders.wise_quote_uuid IS 'Wise quote UUID used for this transfer';
COMMENT ON COLUMN visa_orders.wise_recipient_id IS 'Wise recipient account ID (Migma account)';
COMMENT ON COLUMN visa_orders.wise_payment_status IS 'Wise-specific payment status (incoming_payment_waiting, processing, funds_converted, outgoing_payment_sent, etc.)';

-- Create index on wise_transfer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_visa_orders_wise_transfer_id ON visa_orders(wise_transfer_id);
