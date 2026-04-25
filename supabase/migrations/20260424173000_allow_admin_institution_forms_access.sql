-- Allow CRM admins to read and update institution forms.
-- Student policies remain scoped to the owning user_profile.

CREATE POLICY "Admins can view all institution forms"
ON public.institution_forms
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
);

CREATE POLICY "Admins can update all institution forms"
ON public.institution_forms
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin')
);
