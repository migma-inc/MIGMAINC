-- Allow the student support chat to track the student's own unread window and
-- deduplicate email notifications when admin/mentor sends messages.

ALTER TABLE public.support_chat_read_receipts
  DROP CONSTRAINT IF EXISTS support_chat_read_receipts_viewer_role_check;

ALTER TABLE public.support_chat_read_receipts
  ADD CONSTRAINT support_chat_read_receipts_viewer_role_check
  CHECK (viewer_role IN ('admin', 'mentor', 'student'));

CREATE OR REPLACE FUNCTION private.set_support_chat_read_receipt_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  active_mentor_profile_id uuid;
  student_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to mark support chat read receipts.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'Changing the receipt profile_id is not allowed.';
  END IF;

  IF NEW.last_read_message_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.support_chat_messages scm
      WHERE scm.id = NEW.last_read_message_id
        AND scm.profile_id = NEW.profile_id
    )
  THEN
    RAISE EXCEPTION 'last_read_message_id must belong to the same profile_id.';
  END IF;

  active_mentor_profile_id := private.current_active_mentor_profile_id();

  SELECT up.id
    INTO student_profile_id
  FROM public.user_profiles up
  WHERE up.id = NEW.profile_id
    AND up.user_id = auth.uid()
  LIMIT 1;

  NEW.viewer_user_id := auth.uid();
  NEW.last_read_at := now();
  NEW.updated_at := now();

  IF private.is_support_chat_admin() THEN
    NEW.viewer_profile_id := NULL;
    NEW.viewer_role := 'admin';
  ELSIF private.mentor_can_access_profile(NEW.profile_id) THEN
    NEW.viewer_profile_id := active_mentor_profile_id;
    NEW.viewer_role := 'mentor';
  ELSIF student_profile_id IS NOT NULL THEN
    NEW.viewer_profile_id := student_profile_id;
    NEW.viewer_role := 'student';
  ELSE
    RAISE EXCEPTION 'Only admins, assigned active mentors, and the student can mark support chat read receipts.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Students can read own support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Students can read own support chat read receipts"
  ON public.support_chat_read_receipts
  FOR SELECT
  TO authenticated
  USING (
    viewer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = support_chat_read_receipts.profile_id
        AND up.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can insert own support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Students can insert own support chat read receipts"
  ON public.support_chat_read_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_user_id = auth.uid()
    AND viewer_role = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = support_chat_read_receipts.profile_id
        AND up.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can update own support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Students can update own support chat read receipts"
  ON public.support_chat_read_receipts
  FOR UPDATE
  TO authenticated
  USING (
    viewer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = support_chat_read_receipts.profile_id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    viewer_user_id = auth.uid()
    AND viewer_role = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = support_chat_read_receipts.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.support_chat_student_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.support_chat_messages(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role text NOT NULL,
  read_receipt_key text NOT NULL,
  read_receipt_last_read_at timestamptz,
  sent_to_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  email_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_chat_student_email_notifications_sender_role_check
    CHECK (sender_role IN ('admin', 'mentor')),
  CONSTRAINT support_chat_student_email_notifications_status_check
    CHECK (status IN ('pending', 'sent', 'failed')),
  CONSTRAINT support_chat_student_email_notifications_window_unique
    UNIQUE (profile_id, student_user_id, read_receipt_key)
);

CREATE INDEX IF NOT EXISTS idx_support_chat_student_email_notifications_profile
  ON public.support_chat_student_email_notifications(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_student_email_notifications_student
  ON public.support_chat_student_email_notifications(student_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_student_email_notifications_message
  ON public.support_chat_student_email_notifications(message_id);

ALTER TABLE public.support_chat_student_email_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_chat_student_email_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_chat_student_email_notifications TO service_role;
