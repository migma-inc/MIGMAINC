-- Migration: Update foreign key constraints for contract_template_id to allow automatic NULL on delete
-- This allows templates to be deleted without manual reference removal

-- Drop existing foreign key constraints
ALTER TABLE terms_acceptance 
DROP CONSTRAINT IF EXISTS terms_acceptance_contract_template_id_fkey;

ALTER TABLE partner_terms_acceptances 
DROP CONSTRAINT IF EXISTS partner_terms_acceptances_contract_template_id_fkey;

-- Recreate with ON DELETE SET NULL
ALTER TABLE terms_acceptance 
ADD CONSTRAINT terms_acceptance_contract_template_id_fkey 
FOREIGN KEY (contract_template_id) 
REFERENCES contract_templates(id) 
ON DELETE SET NULL;

ALTER TABLE partner_terms_acceptances 
ADD CONSTRAINT partner_terms_acceptances_contract_template_id_fkey 
FOREIGN KEY (contract_template_id) 
REFERENCES contract_templates(id) 
ON DELETE SET NULL;

-- Add comments
COMMENT ON CONSTRAINT terms_acceptance_contract_template_id_fkey ON terms_acceptance IS 'Foreign key to contract_templates. Automatically sets to NULL when template is deleted.';
COMMENT ON CONSTRAINT partner_terms_acceptances_contract_template_id_fkey ON partner_terms_acceptances IS 'Foreign key to contract_templates. Automatically sets to NULL when template is deleted.';

