-- Allow active referral mentors to read only the student profiles assigned to them.
--
-- The helper lives outside the exposed public schema to avoid putting a
-- SECURITY DEFINER function in an API-exposed schema. It also avoids recursive
-- RLS on public.user_profiles when resolving the current mentor profile.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_active_mentor_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT up.id
  FROM public.user_profiles up
  INNER JOIN public.referral_mentors rm
    ON rm.profile_id = up.id
   AND rm.active = true
  WHERE up.user_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.current_active_mentor_profile_id() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_active_mentor_profile_id() TO authenticated;

DROP POLICY IF EXISTS "Mentors can read assigned user_profiles" ON public.user_profiles;
CREATE POLICY "Mentors can read assigned user_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    mentor_id IS NOT NULL
    AND mentor_id = private.current_active_mentor_profile_id()
  );
