-- Migration: Add contract verification system for Global Partner
-- Adds verification/approval functionality for partner contracts (similar to visa checkout)

-- Add verification fields to partner_terms_acceptances table
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS verification_reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

-- Create index on verification_status for fast filtering
CREATE INDEX IF NOT EXISTS idx_partner_terms_acceptances_verification_status 
ON partner_terms_acceptances(verification_status) 
WHERE verification_status = 'pending';

-- Create index on accepted_at for finding contracts that need verification
CREATE INDEX IF NOT EXISTS idx_partner_terms_acceptances_accepted_at 
ON partner_terms_acceptances(accepted_at) 
WHERE accepted_at IS NOT NULL;

-- Update global_partner_applications status constraint to include new statuses
DO $$
BEGIN
    -- Check if constraint exists and drop it
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'global_partner_applications_status_check'
    ) THEN
        ALTER TABLE global_partner_applications 
        DROP CONSTRAINT global_partner_applications_status_check;
    END IF;
END $$;

-- Add new constraint with updated status values (including active_partner and verification_failed)
ALTER TABLE global_partner_applications
ADD CONSTRAINT global_partner_applications_status_check 
CHECK (status IN ('pending', 'approved', 'approved_for_meeting', 'approved_for_contract', 'active_partner', 'verification_failed', 'rejected'));

-- Add comments to document the fields
COMMENT ON COLUMN partner_terms_acceptances.verification_status IS 'Status of contract verification: pending (awaiting review), approved (verified and active), rejected (needs resubmission)';
COMMENT ON COLUMN partner_terms_acceptances.verification_reviewed_by IS 'User ID or email of admin who reviewed the contract';
COMMENT ON COLUMN partner_terms_acceptances.verification_reviewed_at IS 'Timestamp when the contract was reviewed';
COMMENT ON COLUMN partner_terms_acceptances.verification_rejection_reason IS 'Reason for rejection if verification_status is rejected';

