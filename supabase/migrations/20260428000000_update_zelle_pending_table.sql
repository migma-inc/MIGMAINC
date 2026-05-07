-- Add columns to application_fee_zelle_pending to support cross-system approval
ALTER TABLE application_fee_zelle_pending
  ADD COLUMN IF NOT EXISTS matriculausa_payment_id uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text;

-- Migrate existing 'pending' records to 'pending_verification' so the edge function
-- filter (.eq("status", "pending_verification")) finds them correctly.
UPDATE application_fee_zelle_pending
SET status = 'pending_verification'
WHERE status = 'pending';
