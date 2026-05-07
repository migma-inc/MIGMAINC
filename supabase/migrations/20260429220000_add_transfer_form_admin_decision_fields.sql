-- Add admin decision fields for transfer form review
ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS transfer_form_admin_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS transfer_form_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS transfer_form_reviewed_at TIMESTAMPTZ;
-- transfer_form_admin_status: 'pending' | 'approved' | 'rejected'
