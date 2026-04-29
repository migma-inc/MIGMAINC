-- Add transfer_form_url to institution_applications
-- Populated by the receive-matriculausa-letter webhook when MatriculaUSA
-- issues the Transfer Form alongside the Acceptance Letter.

ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS transfer_form_url TEXT;
