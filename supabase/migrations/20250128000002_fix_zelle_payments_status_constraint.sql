-- Migration: Fix zelle_payments status constraint
-- This ensures the constraint matches the expected values

-- Drop existing constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'zelle_payments_status_check'
        AND conrelid = 'zelle_payments'::regclass
    ) THEN
        ALTER TABLE zelle_payments 
        DROP CONSTRAINT zelle_payments_status_check;
    END IF;
END $$;

-- Add correct constraint
ALTER TABLE zelle_payments
ADD CONSTRAINT zelle_payments_status_check 
CHECK (status IN ('pending_verification', 'approved', 'rejected'));
