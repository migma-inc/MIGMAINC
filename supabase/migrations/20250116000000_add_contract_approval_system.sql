-- Migration: Add contract approval system for Visa Checkout
-- Adds approval/rejection functionality for contracts with resubmission tokens

-- Add approval fields to visa_orders table
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS contract_approval_status TEXT DEFAULT 'pending' CHECK (contract_approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS contract_approval_reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS contract_approval_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contract_rejection_reason TEXT;

-- Create table for resubmission tokens
CREATE TABLE IF NOT EXISTS visa_contract_resubmission_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES visa_orders(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_visa_contract_resubmission_tokens_token ON visa_contract_resubmission_tokens(token);
CREATE INDEX IF NOT EXISTS idx_visa_contract_resubmission_tokens_order_id ON visa_contract_resubmission_tokens(order_id);

-- Create index on approval status for filtering
CREATE INDEX IF NOT EXISTS idx_visa_orders_contract_approval_status ON visa_orders(contract_approval_status);















