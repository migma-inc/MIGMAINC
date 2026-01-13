-- Migration: Add chargeback_annex template type for dynamic ANNEX I management
-- Allows ANNEX I (chargeback terms) to be managed dynamically like other contract templates

-- Add 'chargeback_annex' to the enum type
ALTER TYPE contract_template_type ADD VALUE IF NOT EXISTS 'chargeback_annex';

-- Update constraint to allow chargeback_annex without product_slug (global) or with product_slug (specific)
ALTER TABLE contract_templates 
DROP CONSTRAINT IF EXISTS check_visa_service_has_product_slug;

ALTER TABLE contract_templates 
ADD CONSTRAINT check_template_type_product_slug 
CHECK (
  (template_type = 'visa_service' AND product_slug IS NOT NULL) OR 
  (template_type = 'global_partner') OR
  (template_type = 'chargeback_annex')
);

-- Create index for chargeback_annex templates
CREATE INDEX IF NOT EXISTS idx_contract_templates_chargeback_annex 
ON contract_templates(template_type, is_active) 
WHERE template_type = 'chargeback_annex' AND is_active = true;

-- Add comment explaining chargeback_annex type
COMMENT ON TYPE contract_template_type IS 'Template types: global_partner (Global Partner contracts), visa_service (Visa service contracts with product_slug), chargeback_annex (ANNEX I - Payment Authorization & Non-Dispute Agreement, can be global or product-specific)';
