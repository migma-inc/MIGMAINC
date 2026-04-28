-- Allow CRM admins to assign referral mentors on student profiles.

DROP POLICY IF EXISTS "Admins can update user_profiles" ON public.user_profiles;
CREATE POLICY "Admins can update user_profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
  );
