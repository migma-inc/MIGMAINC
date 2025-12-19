-- Migration: Add legal fields to partner_terms_acceptances table
-- Adds fields for contract version, hash, and geolocation tracking

ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS contract_version TEXT,
ADD COLUMN IF NOT EXISTS contract_hash TEXT,
ADD COLUMN IF NOT EXISTS geolocation_country TEXT,
ADD COLUMN IF NOT EXISTS geolocation_city TEXT;

-- Add comments to document the fields
COMMENT ON COLUMN partner_terms_acceptances.contract_version IS 'Version of the contract that was accepted (e.g., v1.0-2025-01-15)';
COMMENT ON COLUMN partner_terms_acceptances.contract_hash IS 'SHA-256 hash of the contract content for integrity verification';
COMMENT ON COLUMN partner_terms_acceptances.geolocation_country IS 'Country obtained via IP geolocation';
COMMENT ON COLUMN partner_terms_acceptances.geolocation_city IS 'City obtained via IP geolocation (optional)';

