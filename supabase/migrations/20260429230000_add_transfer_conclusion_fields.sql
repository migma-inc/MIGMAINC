-- Transfer form delivery confirmation + conclusion tracking
ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS transfer_form_delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_concluded_at TIMESTAMPTZ;
-- transfer_form_delivered_at: set when student confirms delivery to current school
-- transfer_concluded_at: set by admin when transfer is fully completed (SEVIS released, I-20 issued)
