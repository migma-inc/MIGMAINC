-- Per-student AI runtime controls for support chat.
--
-- Global defaults stay in public.support_chat_runtime_settings.
-- This table stores overrides for one student/conversation so a mentor does
-- not accidentally change AI behavior for every student.

CREATE TABLE IF NOT EXISTS public.support_chat_profile_ai_controls (
  profile_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ai_enabled boolean NOT NULL DEFAULT true,
  human_timeout_minutes integer NOT NULL DEFAULT 60,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_role text,
  CONSTRAINT support_chat_profile_ai_controls_timeout_check CHECK (
    human_timeout_minutes BETWEEN 1 AND 1440
  ),
  CONSTRAINT support_chat_profile_ai_controls_updated_by_role_check CHECK (
    updated_by_role IS NULL OR updated_by_role IN ('admin', 'mentor')
  )
);

CREATE INDEX IF NOT EXISTS idx_support_chat_profile_ai_controls_updated
  ON public.support_chat_profile_ai_controls(updated_at DESC);

ALTER TABLE public.support_chat_profile_ai_controls ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_chat_profile_ai_controls FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_chat_profile_ai_controls TO authenticated;
GRANT ALL ON public.support_chat_profile_ai_controls TO service_role;

CREATE OR REPLACE FUNCTION private.set_support_chat_profile_ai_control_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update support chat AI controls.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'Changing profile_id is not allowed for support chat AI controls.';
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := auth.uid();

  IF private.is_support_chat_admin() THEN
    NEW.updated_by_role := 'admin';
  ELSIF private.mentor_can_access_profile(NEW.profile_id) THEN
    NEW.updated_by_role := 'mentor';
  ELSE
    RAISE EXCEPTION 'Only admins and assigned active mentors can update support chat AI controls.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_support_chat_profile_ai_control_actor() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_support_chat_profile_ai_control_actor
  ON public.support_chat_profile_ai_controls;

CREATE TRIGGER trg_set_support_chat_profile_ai_control_actor
  BEFORE INSERT OR UPDATE ON public.support_chat_profile_ai_controls
  FOR EACH ROW
  EXECUTE FUNCTION private.set_support_chat_profile_ai_control_actor();

DROP POLICY IF EXISTS "Admins can read support chat AI controls"
  ON public.support_chat_profile_ai_controls;

CREATE POLICY "Admins can read support chat AI controls"
  ON public.support_chat_profile_ai_controls
  FOR SELECT
  TO authenticated
  USING (private.is_support_chat_admin());

DROP POLICY IF EXISTS "Admins can insert support chat AI controls"
  ON public.support_chat_profile_ai_controls;

CREATE POLICY "Admins can insert support chat AI controls"
  ON public.support_chat_profile_ai_controls
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_support_chat_admin());

DROP POLICY IF EXISTS "Admins can update support chat AI controls"
  ON public.support_chat_profile_ai_controls;

CREATE POLICY "Admins can update support chat AI controls"
  ON public.support_chat_profile_ai_controls
  FOR UPDATE
  TO authenticated
  USING (private.is_support_chat_admin())
  WITH CHECK (private.is_support_chat_admin());

DROP POLICY IF EXISTS "Mentors can read assigned support chat AI controls"
  ON public.support_chat_profile_ai_controls;

CREATE POLICY "Mentors can read assigned support chat AI controls"
  ON public.support_chat_profile_ai_controls
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can insert assigned support chat AI controls"
  ON public.support_chat_profile_ai_controls;

CREATE POLICY "Mentors can insert assigned support chat AI controls"
  ON public.support_chat_profile_ai_controls
  FOR INSERT
  TO authenticated
  WITH CHECK (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can update assigned support chat AI controls"
  ON public.support_chat_profile_ai_controls;

CREATE POLICY "Mentors can update assigned support chat AI controls"
  ON public.support_chat_profile_ai_controls
  FOR UPDATE
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id))
  WITH CHECK (private.mentor_can_access_profile(profile_id));
