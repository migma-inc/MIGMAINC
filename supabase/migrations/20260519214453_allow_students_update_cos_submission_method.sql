-- Allow students to save their own COS submission path from the student dashboard.
-- The underlying RLS check still ties the row to auth.uid() through user_profiles.
GRANT UPDATE (submission_method, current_step, updated_at) ON public.cos_cases TO authenticated;

DROP POLICY IF EXISTS "Students can update their own COS submission path" ON public.cos_cases;
CREATE POLICY "Students can update their own COS submission path"
  ON public.cos_cases
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_cases.profile_id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_cases.profile_id
        AND up.user_id = auth.uid()
    )
    AND submission_method IN ('undecided', 'online', 'mail')
    AND (has_dependents IS NOT TRUE OR submission_method = 'mail')
    AND current_step IN ('submission_method', 'generation_submission')
  );
