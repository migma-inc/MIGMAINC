-- Migration: Add admin email tracking fields to visa_orders and partner_terms_acceptances
-- Goal: Track which contracts have been sent to administration emails

-- 1. Add columns to visa_orders
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS admin_email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN visa_orders.admin_email_sent IS 'Indica se o email administrativo com PDF foi enviado (info@migmainc.com)';
COMMENT ON COLUMN visa_orders.admin_email_sent_at IS 'Data/hora do envio do email administrativo';

-- 2. Add columns to partner_terms_acceptances
ALTER TABLE partner_terms_acceptances
ADD COLUMN IF NOT EXISTS admin_email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN partner_terms_acceptances.admin_email_sent IS 'Indica se o email administrativo com PDF foi enviado (adm@migmainc.com)';
COMMENT ON COLUMN partner_terms_acceptances.admin_email_sent_at IS 'Data/hora do envio do email administrativo';

-- 3. Create indexes for performance in the admin page
CREATE INDEX IF NOT EXISTS idx_visa_orders_admin_email_sent ON visa_orders(admin_email_sent) WHERE admin_email_sent = FALSE;
CREATE INDEX IF NOT EXISTS idx_partner_terms_acceptances_admin_email_sent ON partner_terms_acceptances(admin_email_sent) WHERE admin_email_sent = FALSE;
