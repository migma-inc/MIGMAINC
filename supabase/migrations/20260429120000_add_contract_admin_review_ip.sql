-- Store the admin request IP used when reviewing the internal Migma contract.

ALTER TABLE public.visa_orders
ADD COLUMN IF NOT EXISTS contract_approval_admin_ip TEXT,
ADD COLUMN IF NOT EXISTS annex_approval_admin_ip TEXT,
ADD COLUMN IF NOT EXISTS upsell_contract_approval_admin_ip TEXT,
ADD COLUMN IF NOT EXISTS upsell_annex_approval_admin_ip TEXT;

COMMENT ON COLUMN public.visa_orders.contract_approval_admin_ip IS
  'IP address from the admin request that approved or rejected the main contract.';

