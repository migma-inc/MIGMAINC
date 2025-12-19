-- Migration: Add contractual data fields to partner_terms_acceptances table
-- Adds fields for personal identification, address, tax/business structure, and payment info

-- Identificação Pessoal
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS full_legal_name TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS country_of_residence TEXT,
ADD COLUMN IF NOT EXISTS phone_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Endereço
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS address_country TEXT;

-- Estrutura Fiscal/Empresarial
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS business_type TEXT CHECK (business_type IN ('Individual', 'Company')),
ADD COLUMN IF NOT EXISTS tax_id_type TEXT,
ADD COLUMN IF NOT EXISTS tax_id_number TEXT,
ADD COLUMN IF NOT EXISTS company_legal_name TEXT;

-- Pagamento
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS preferred_payout_method TEXT,
ADD COLUMN IF NOT EXISTS payout_details TEXT;

-- Comentários para documentação
COMMENT ON COLUMN partner_terms_acceptances.full_legal_name IS 'Full legal name as provided by contractor (may differ from application name)';
COMMENT ON COLUMN partner_terms_acceptances.date_of_birth IS 'Date of birth of the contractor';
COMMENT ON COLUMN partner_terms_acceptances.nationality IS 'Nationality of the contractor';
COMMENT ON COLUMN partner_terms_acceptances.country_of_residence IS 'Country where contractor currently resides';
COMMENT ON COLUMN partner_terms_acceptances.phone_whatsapp IS 'Phone or WhatsApp number for contact';
COMMENT ON COLUMN partner_terms_acceptances.email IS 'Email address (pre-filled from application but can be edited)';
COMMENT ON COLUMN partner_terms_acceptances.business_type IS 'Business structure: Individual or Company';
COMMENT ON COLUMN partner_terms_acceptances.tax_id_type IS 'Type of tax ID: CNPJ, NIF, Equivalent, etc.';
COMMENT ON COLUMN partner_terms_acceptances.preferred_payout_method IS 'Preferred payment method: Wise, Stripe, Other';

