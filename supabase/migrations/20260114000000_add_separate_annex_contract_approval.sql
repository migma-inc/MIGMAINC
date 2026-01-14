-- Migration: Add separate approval fields for ANNEX I and Contract
-- Allows approving/rejecting ANNEX I and Contract separately

-- Add ANNEX approval fields to visa_orders table
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS annex_approval_status TEXT DEFAULT 'pending' CHECK (annex_approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS annex_approval_reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS annex_approval_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS annex_rejection_reason TEXT;

-- Rename existing contract_approval fields to be more explicit (they refer to the main contract)
-- Note: These fields already exist, so we're just adding comments for clarity
COMMENT ON COLUMN visa_orders.contract_approval_status IS 'Approval status for the main Contract PDF (not ANNEX I)';
COMMENT ON COLUMN visa_orders.annex_approval_status IS 'Approval status for the ANNEX I PDF (separate from main Contract)';

-- Create indexes for ANNEX approval status
CREATE INDEX IF NOT EXISTS idx_visa_orders_annex_approval_status ON visa_orders(annex_approval_status);

-- Create index for filtering pending approvals (both types)
CREATE INDEX IF NOT EXISTS idx_visa_orders_pending_approvals ON visa_orders(contract_approval_status, annex_approval_status)
WHERE contract_approval_status = 'pending' OR annex_approval_status = 'pending';
