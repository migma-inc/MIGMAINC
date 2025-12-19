-- Migration: Add meeting fields to global_partner_applications table
-- Adds fields for meeting scheduling and updates status constraint

-- Add meeting-related fields
ALTER TABLE global_partner_applications
ADD COLUMN IF NOT EXISTS meeting_date DATE,
ADD COLUMN IF NOT EXISTS meeting_time TEXT,
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS meeting_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS meeting_scheduled_by TEXT;

-- Update status constraint to include new status values
-- First, drop the existing constraint if it exists (PostgreSQL doesn't support ALTER CHECK directly)
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

-- Add new constraint with updated status values
ALTER TABLE global_partner_applications
ADD CONSTRAINT global_partner_applications_status_check 
CHECK (status IN ('pending', 'approved', 'approved_for_meeting', 'approved_for_contract', 'rejected'));

-- Create index on meeting_date for filtering upcoming meetings
CREATE INDEX IF NOT EXISTS idx_global_partner_applications_meeting_date 
ON global_partner_applications(meeting_date) 
WHERE meeting_date IS NOT NULL;

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_global_partner_applications_status 
ON global_partner_applications(status);

