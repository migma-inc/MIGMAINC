-- Migration: Add maturation period fields to seller_commissions
-- Adds fields to track when commissions become available for withdrawal and track withdrawn/reserved amounts

-- Add new columns to seller_commissions table
ALTER TABLE seller_commissions
ADD COLUMN IF NOT EXISTS available_for_withdrawal_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS reserved_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL;

-- Add comments
COMMENT ON COLUMN seller_commissions.available_for_withdrawal_at IS 'Date when commission becomes available for withdrawal (created_at + 30 days)';
COMMENT ON COLUMN seller_commissions.withdrawn_amount IS 'Amount already withdrawn from this commission';
COMMENT ON COLUMN seller_commissions.reserved_amount IS 'Amount reserved in a pending payment request';

-- Update existing commissions to set available_for_withdrawal_at
-- For existing commissions, set to created_at + 30 days if not already set
UPDATE seller_commissions
SET available_for_withdrawal_at = created_at + INTERVAL '30 days'
WHERE available_for_withdrawal_at IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_seller_commissions_available_at 
ON seller_commissions(available_for_withdrawal_at);

CREATE INDEX IF NOT EXISTS idx_seller_commissions_withdrawn 
ON seller_commissions(seller_id, withdrawn_amount) 
WHERE withdrawn_amount > 0;

CREATE INDEX IF NOT EXISTS idx_seller_commissions_reserved 
ON seller_commissions(seller_id, reserved_amount) 
WHERE reserved_amount > 0;
