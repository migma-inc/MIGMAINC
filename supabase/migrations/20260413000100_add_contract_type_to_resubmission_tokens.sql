ALTER TABLE public.visa_contract_resubmission_tokens
ADD COLUMN IF NOT EXISTS contract_type TEXT
CHECK (contract_type IN ('contract', 'annex', 'upsell_contract', 'upsell_annex'));

UPDATE public.visa_contract_resubmission_tokens
SET contract_type = 'contract'
WHERE contract_type IS NULL;
