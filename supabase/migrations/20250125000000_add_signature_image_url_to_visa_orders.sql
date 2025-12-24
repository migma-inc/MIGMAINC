-- Migration: Add signature_image_url field to visa_orders table
-- Adds field to store the signature pad image URL (drawn signature)

ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS signature_image_url TEXT;

-- Add comment to document the field
COMMENT ON COLUMN visa_orders.signature_image_url IS 'URL of the signature pad image (PNG) stored in Supabase Storage. This is the drawn signature captured via Signature Pad component in Step 3 of checkout.';

