-- Migration: add payment_link columns to institution_applications
-- Required by ScholarshipApprovalTab (admin approval flow) and PlacementFeeStep (student UI)

ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_link_generated_at TIMESTAMPTZ;

-- Admins can SELECT any institution_application (to view student selections in approval tab)
CREATE POLICY "Admins can read all applications"
  ON public.institution_applications
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Admins can UPDATE any institution_application (approve, set payment link, reject others)
CREATE POLICY "Admins can update all applications"
  ON public.institution_applications
  FOR UPDATE
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
