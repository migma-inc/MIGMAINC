-- Migration: Add signature_image_url field to partner_terms_acceptances table
-- Adds field to store the signature pad image URL (replaces or complements signature_name)

ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS signature_image_url TEXT;

-- Add comment to document the field
COMMENT ON COLUMN partner_terms_acceptances.signature_image_url IS 'URL of the signature pad image (PNG) stored in Supabase Storage. This is the drawn signature captured via Signature Pad component.';

-- Keep signature_name for backward compatibility, but signature_image_url will be the primary signature method
