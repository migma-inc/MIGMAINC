-- Fix student RLS for institution_forms.
-- institution_forms.profile_id stores user_profiles.id, not auth.users.id.
-- Students must be authorized through user_profiles.user_id = auth.uid().

DROP POLICY IF EXISTS "Users can view their own forms" ON public.institution_forms;
DROP POLICY IF EXISTS "Users can update their own forms" ON public.institution_forms;

CREATE POLICY "Students can view their own institution forms"
ON public.institution_forms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = institution_forms.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Students can update their own institution forms"
ON public.institution_forms
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = institution_forms.profile_id
      AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = institution_forms.profile_id
      AND up.user_id = auth.uid()
  )
);
