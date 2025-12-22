-- Migration: Add contract templates system
-- Creates contract_templates table and adds contract_template_id to partner_terms_acceptances

-- Create contract_templates table
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Add contract_template_id to partner_terms_acceptances
ALTER TABLE partner_terms_acceptances 
ADD COLUMN IF NOT EXISTS contract_template_id UUID REFERENCES contract_templates(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contract_templates_is_active ON contract_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_partner_terms_template ON partner_terms_acceptances(contract_template_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contract_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_contract_templates_updated_at
BEFORE UPDATE ON contract_templates
FOR EACH ROW
EXECUTE FUNCTION update_contract_templates_updated_at();

