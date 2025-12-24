-- Migration: Add visa service templates support to contract_templates
-- Adds template_type and product_slug fields to support service-specific contracts

-- Create enum type for template types
DO $$ BEGIN
  CREATE TYPE contract_template_type AS ENUM ('global_partner', 'visa_service');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add template_type column with default 'global_partner' for backward compatibility
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS template_type contract_template_type DEFAULT 'global_partner';

-- Add product_slug column to link templates to specific visa services
ALTER TABLE contract_templates 
ADD COLUMN IF NOT EXISTS product_slug TEXT;

-- Update all existing templates to be 'global_partner' type (safety measure)
UPDATE contract_templates 
SET template_type = 'global_partner' 
WHERE template_type IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_template_type ON contract_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_product_slug ON contract_templates(product_slug);
CREATE INDEX IF NOT EXISTS idx_contract_templates_type_slug_active ON contract_templates(template_type, product_slug, is_active) 
WHERE template_type = 'visa_service' AND is_active = true;

-- Add constraint to ensure product_slug is set when template_type is 'visa_service'
ALTER TABLE contract_templates 
ADD CONSTRAINT check_visa_service_has_product_slug 
CHECK (
  (template_type = 'visa_service' AND product_slug IS NOT NULL) OR 
  (template_type = 'global_partner')
);

-- Add constraint to ensure only one active template per product_slug for visa services
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_visa_template_per_product 
ON contract_templates(product_slug) 
WHERE template_type = 'visa_service' AND is_active = true AND product_slug IS NOT NULL;

-- Add contract_template_id to terms_acceptance table if it doesn't exist
ALTER TABLE terms_acceptance 
ADD COLUMN IF NOT EXISTS contract_template_id UUID REFERENCES contract_templates(id);

-- Create index for terms_acceptance contract_template_id
CREATE INDEX IF NOT EXISTS idx_terms_acceptance_template ON terms_acceptance(contract_template_id);

