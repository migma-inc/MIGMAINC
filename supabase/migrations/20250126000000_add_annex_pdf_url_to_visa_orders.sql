-- Migration: Add annex_pdf_url field to visa_orders table
-- Adds field to store the URL of the ANNEX I PDF (Payment Authorization & Non-Dispute Agreement)
-- This PDF is generated for scholarship and i20-control products after payment confirmation

ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS annex_pdf_url TEXT;

-- Add comment to document the field
COMMENT ON COLUMN visa_orders.annex_pdf_url IS 'URL of the ANNEX I PDF (Payment Authorization & Non-Dispute Agreement) stored in Supabase Storage. Generated automatically for scholarship and i20-control products after payment confirmation.';

