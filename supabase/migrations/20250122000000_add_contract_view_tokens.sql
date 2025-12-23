-- Migration: Add contract view tokens system for Global Partner
-- Allows partners to view their signed contract via secure token link

-- Create table for contract view tokens
CREATE TABLE IF NOT EXISTS partner_contract_view_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acceptance_id UUID NOT NULL REFERENCES partner_terms_acceptances(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_partner_contract_view_tokens_token 
ON partner_contract_view_tokens(token);

-- Create index on acceptance_id for finding tokens by contract
CREATE INDEX IF NOT EXISTS idx_partner_contract_view_tokens_acceptance_id 
ON partner_contract_view_tokens(acceptance_id);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_partner_contract_view_tokens_expires_at 
ON partner_contract_view_tokens(expires_at);

-- Add comments to document the table
COMMENT ON TABLE partner_contract_view_tokens IS 'Tokens for secure viewing of signed partner contracts. Each token allows viewing a specific contract via a unique link.';
COMMENT ON COLUMN partner_contract_view_tokens.acceptance_id IS 'Reference to the partner_terms_acceptances record (the signed contract)';
COMMENT ON COLUMN partner_contract_view_tokens.token IS 'Unique token string used in the view URL';
COMMENT ON COLUMN partner_contract_view_tokens.expires_at IS 'Token expiration date (typically 90 days from creation)';
COMMENT ON COLUMN partner_contract_view_tokens.created_at IS 'Timestamp when the token was created';

