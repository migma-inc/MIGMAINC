-- Migration: Make contract view tokens infinite (no expiration)
-- Allows tokens to never expire by making expires_at nullable

-- Alter column to allow NULL (infinite tokens)
ALTER TABLE partner_contract_view_tokens
ALTER COLUMN expires_at DROP NOT NULL;

-- Update all existing tokens to have no expiration (NULL = infinite)
UPDATE partner_contract_view_tokens
SET expires_at = NULL
WHERE expires_at IS NOT NULL;

-- Update comment to reflect the change
COMMENT ON COLUMN partner_contract_view_tokens.expires_at IS 'Token expiration date. NULL means the token never expires (infinite).';
