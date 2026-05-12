-- Track onboarding step inactivity independently from user_profiles.updated_at.
-- updated_at is touched by admin/system writes and is not a reliable student
-- activity signal for follow-up automation.

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step_entered_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_followup_started_at timestamptz;

ALTER TABLE public.user_profiles
  ALTER COLUMN onboarding_followup_started_at SET DEFAULT now();

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_onboarding_current_step_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_onboarding_current_step_check
  CHECK (
    onboarding_current_step IS NULL
    OR onboarding_current_step = ANY (ARRAY[
      'selection_fee'::text,
      'identity_verification'::text,
      'selection_survey'::text,
      'wait_room'::text,
      'scholarship_selection'::text,
      'process_type'::text,
      'documents_upload'::text,
      'payment'::text,
      'scholarship_fee'::text,
      'placement_fee'::text,
      'reinstatement_fee'::text,
      'dados_complementares'::text,
      'my_applications'::text,
      'acceptance_letter'::text,
      'completed'::text,
      'awaiting_client_data'::text,
      'welcome_email_failed'::text
    ])
  );

UPDATE public.user_profiles
SET onboarding_step_entered_at = COALESCE(
  onboarding_step_entered_at,
  last_activity_at,
  migma_checkout_completed_at,
  updated_at,
  created_at,
  now()
)
WHERE onboarding_step_entered_at IS NULL
  AND onboarding_current_step IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.onboarding_step_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  mentor_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  service_family text NOT NULL,
  onboarding_step text NOT NULL,
  step_label text NOT NULL,
  step_url text NOT NULL,
  idle_reference_at timestamptz NOT NULL,
  idle_hours integer NOT NULL DEFAULT 48,
  status text NOT NULL DEFAULT 'open',
  student_notified_at timestamptz,
  mentor_notified_at timestamptz,
  notification_count integer NOT NULL DEFAULT 0,
  student_notification_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  mentor_notification_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  resolved_at timestamptz,
  resolved_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_step_followups
  DROP CONSTRAINT IF EXISTS onboarding_step_followups_service_family_check;

ALTER TABLE public.onboarding_step_followups
  ADD CONSTRAINT onboarding_step_followups_service_family_check
  CHECK (service_family IN ('cos', 'transfer', 'initial'));

ALTER TABLE public.onboarding_step_followups
  DROP CONSTRAINT IF EXISTS onboarding_step_followups_status_check;

ALTER TABLE public.onboarding_step_followups
  ADD CONSTRAINT onboarding_step_followups_status_check
  CHECK (status IN ('open', 'resolved', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_step_entered_at
  ON public.user_profiles(onboarding_step_entered_at)
  WHERE onboarding_completed IS NOT TRUE
    AND is_archived IS NOT TRUE
    AND source = 'migma';

CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_followup_started_at
  ON public.user_profiles(onboarding_followup_started_at)
  WHERE onboarding_followup_started_at IS NOT NULL
    AND onboarding_completed IS NOT TRUE
    AND is_archived IS NOT TRUE
    AND source = 'migma';

CREATE INDEX IF NOT EXISTS idx_onboarding_step_followups_profile_id
  ON public.onboarding_step_followups(profile_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_step_followups_mentor_status
  ON public.onboarding_step_followups(mentor_profile_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_onboarding_step_followups_status_created
  ON public.onboarding_step_followups(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_onboarding_step_followups_open_profile_step
  ON public.onboarding_step_followups(profile_id, onboarding_step)
  WHERE status = 'open';

CREATE OR REPLACE FUNCTION private.track_user_profile_onboarding_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.onboarding_current_step IS NOT NULL
      AND NEW.onboarding_step_entered_at IS NULL THEN
      NEW.onboarding_step_entered_at := COALESCE(
        NEW.migma_checkout_completed_at,
        NEW.created_at,
        now()
      );
    END IF;

    IF NEW.user_id IS NOT NULL
      AND auth.uid() = NEW.user_id
      AND NEW.last_activity_at IS NULL THEN
      NEW.last_activity_at := now();
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.onboarding_current_step IS DISTINCT FROM OLD.onboarding_current_step THEN
    NEW.onboarding_step_entered_at := now();
  END IF;

  IF NEW.user_id IS NOT NULL
    AND auth.uid() = NEW.user_id THEN
    NEW.last_activity_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_user_profile_onboarding_activity
  ON public.user_profiles;

CREATE TRIGGER trg_track_user_profile_onboarding_activity
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.track_user_profile_onboarding_activity();

CREATE OR REPLACE FUNCTION private.update_onboarding_step_followups_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_onboarding_step_followups_updated_at
  ON public.onboarding_step_followups;

CREATE TRIGGER trg_update_onboarding_step_followups_updated_at
  BEFORE UPDATE ON public.onboarding_step_followups
  FOR EACH ROW
  EXECUTE FUNCTION private.update_onboarding_step_followups_updated_at();

CREATE OR REPLACE FUNCTION private.resolve_onboarding_step_followups_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.onboarding_current_step IS DISTINCT FROM OLD.onboarding_current_step THEN
    UPDATE public.onboarding_step_followups
    SET
      status = 'resolved',
      resolved_at = now(),
      resolved_reason = 'step_changed'
    WHERE profile_id = NEW.id
      AND status = 'open'
      AND onboarding_step = OLD.onboarding_current_step;
  ELSIF NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at THEN
    UPDATE public.onboarding_step_followups
    SET
      status = 'resolved',
      resolved_at = now(),
      resolved_reason = 'student_activity'
    WHERE profile_id = NEW.id
      AND status = 'open'
      AND onboarding_step = NEW.onboarding_current_step
      AND idle_reference_at < NEW.last_activity_at;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_onboarding_step_followups_on_activity
  ON public.user_profiles;

CREATE TRIGGER trg_resolve_onboarding_step_followups_on_activity
  AFTER UPDATE OF onboarding_current_step, last_activity_at ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.resolve_onboarding_step_followups_on_activity();

CREATE OR REPLACE FUNCTION private.touch_user_profile_activity_by_profile_id(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_activity_at = now()
  WHERE id = p_profile_id
    AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION private.touch_user_profile_activity_by_user_id(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.user_profiles
  SET last_activity_at = now()
  WHERE user_id = p_user_id
    AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION private.touch_onboarding_activity_from_profile_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL THEN
    PERFORM private.touch_user_profile_activity_by_profile_id(NEW.profile_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.touch_onboarding_activity_from_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM private.touch_user_profile_activity_by_user_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_activity_selection_survey_responses
  ON public.selection_survey_responses;
CREATE TRIGGER trg_touch_activity_selection_survey_responses
  AFTER INSERT OR UPDATE ON public.selection_survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_onboarding_activity_from_profile_id();

DROP TRIGGER IF EXISTS trg_touch_activity_student_complementary_data
  ON public.student_complementary_data;
CREATE TRIGGER trg_touch_activity_student_complementary_data
  AFTER INSERT OR UPDATE ON public.student_complementary_data
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_onboarding_activity_from_profile_id();

DROP TRIGGER IF EXISTS trg_touch_activity_global_document_requests
  ON public.global_document_requests;
CREATE TRIGGER trg_touch_activity_global_document_requests
  AFTER INSERT OR UPDATE ON public.global_document_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_onboarding_activity_from_profile_id();

DROP TRIGGER IF EXISTS trg_touch_activity_student_documents
  ON public.student_documents;
CREATE TRIGGER trg_touch_activity_student_documents
  AFTER INSERT OR UPDATE ON public.student_documents
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_onboarding_activity_from_user_id();

DROP TRIGGER IF EXISTS trg_touch_activity_user_identity
  ON public.user_identity;
CREATE TRIGGER trg_touch_activity_user_identity
  AFTER INSERT OR UPDATE ON public.user_identity
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_onboarding_activity_from_user_id();

ALTER TABLE public.onboarding_step_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage onboarding_step_followups"
  ON public.onboarding_step_followups;
CREATE POLICY "Service role can manage onboarding_step_followups"
  ON public.onboarding_step_followups
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read onboarding_step_followups"
  ON public.onboarding_step_followups;
CREATE POLICY "Admins can read onboarding_step_followups"
  ON public.onboarding_step_followups
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
  );

DROP POLICY IF EXISTS "Mentors can read assigned onboarding_step_followups"
  ON public.onboarding_step_followups;
CREATE POLICY "Mentors can read assigned onboarding_step_followups"
  ON public.onboarding_step_followups
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id));

COMMENT ON COLUMN public.user_profiles.onboarding_step_entered_at IS
  'Timestamp when the current onboarding_current_step started. Used for 48h inactivity follow-ups.';

COMMENT ON COLUMN public.user_profiles.onboarding_followup_started_at IS
  'Enrollment timestamp for onboarding step follow-up automation. Existing profiles remain null so only new students are eligible by default.';

COMMENT ON TABLE public.onboarding_step_followups IS
  'Automated follow-ups for students idle for 48h+ in the same onboarding step.';
