-- Add student-side transfer form fields to institution_applications
ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS transfer_form_filled_url TEXT,
  ADD COLUMN IF NOT EXISTS transfer_form_student_status TEXT DEFAULT 'pending';
-- transfer_form_student_status: 'pending' | 'received' | 'submitted'
