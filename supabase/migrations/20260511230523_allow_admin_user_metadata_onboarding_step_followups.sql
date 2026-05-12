-- Allow the current CRM admin sessions to read onboarding step follow-ups.
--
-- The preferred authorization source is app_metadata, but the existing admin
-- dashboard still signs admins with user_metadata.role. This keeps the new
-- table visible to the same users that can already read the CRM auxiliary
-- tables while the auth model is migrated.

DROP POLICY IF EXISTS "Admins can read onboarding_step_followups"
  ON public.onboarding_step_followups;

CREATE POLICY "Admins can read onboarding_step_followups"
  ON public.onboarding_step_followups
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
    OR COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
    OR COALESCE(auth.jwt() ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
  );
