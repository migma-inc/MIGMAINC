-- Migration: Add signature_name field to partner_terms_acceptances table
-- Adds field to store the typed full legal name as digital signature

ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS signature_name TEXT;

-- Add comment to document the field
COMMENT ON COLUMN partner_terms_acceptances.signature_name IS 'Full legal name typed by the contractor as their digital signature when accepting the terms';

