-- Enable CRM/admin/mentor realtime reads for the student AI support chat.
-- This file is local only until explicitly approved for the remote database.
--
-- Security model:
-- - Existing frontend role usage in user_metadata is not changed here.
-- - New database authorization for admins uses auth.users.raw_app_meta_data only.
-- - The migration aborts before changing policies if any legacy admin role still
--   depends only on user_metadata, avoiding a silent production lockout.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE COALESCE(u.raw_user_meta_data ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
      AND COALESCE(u.raw_app_meta_data ->> 'role', '') NOT IN ('admin', 'superadmin', 'super_admin')
  ) THEN
    RAISE EXCEPTION
      'Refusing to harden support_chat_messages RLS: copy verified admin roles from user_metadata to raw_app_meta_data first.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.is_support_chat_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND COALESCE(u.raw_app_meta_data ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
  )
$$;

REVOKE ALL ON FUNCTION private.is_support_chat_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_support_chat_admin() TO authenticated;

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read all chat" ON public.support_chat_messages;
DROP POLICY IF EXISTS "Admins can read all support chat" ON public.support_chat_messages;

CREATE POLICY "Admins can read all support chat"
  ON public.support_chat_messages
  FOR SELECT
  TO authenticated
  USING (private.is_support_chat_admin());

DROP POLICY IF EXISTS "Admin insert chat messages" ON public.support_chat_messages;
DROP POLICY IF EXISTS "Admins can insert support chat" ON public.support_chat_messages;

CREATE POLICY "Admins can insert support chat"
  ON public.support_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (private.is_support_chat_admin());

DROP POLICY IF EXISTS "Mentors can manage assigned support chat" ON public.support_chat_messages;
DROP POLICY IF EXISTS "Mentors can read assigned support chat" ON public.support_chat_messages;

CREATE POLICY "Mentors can read assigned support chat"
  ON public.support_chat_messages
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can insert assigned support chat" ON public.support_chat_messages;

CREATE POLICY "Mentors can insert assigned support chat"
  ON public.support_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (private.mentor_can_access_profile(profile_id));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = 'public.support_chat_messages'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.support_chat_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  viewer_role text NOT NULL,
  last_read_message_id uuid REFERENCES public.support_chat_messages(id) ON DELETE SET NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_chat_read_receipts
  DROP CONSTRAINT IF EXISTS support_chat_read_receipts_viewer_role_check;

ALTER TABLE public.support_chat_read_receipts
  ADD CONSTRAINT support_chat_read_receipts_viewer_role_check
  CHECK (viewer_role IN ('admin', 'mentor'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_support_chat_read_receipts_profile_viewer
  ON public.support_chat_read_receipts(profile_id, viewer_user_id);

CREATE INDEX IF NOT EXISTS idx_support_chat_read_receipts_profile_last_read
  ON public.support_chat_read_receipts(profile_id, last_read_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_read_receipts_viewer
  ON public.support_chat_read_receipts(viewer_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_read_receipts_last_message
  ON public.support_chat_read_receipts(last_read_message_id);

ALTER TABLE public.support_chat_read_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_chat_read_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.support_chat_read_receipts TO authenticated;

CREATE OR REPLACE FUNCTION private.set_support_chat_read_receipt_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  active_mentor_profile_id uuid;
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

  NEW.viewer_user_id := auth.uid();
  NEW.last_read_at := now();
  NEW.updated_at := now();

  IF private.is_support_chat_admin() THEN
    NEW.viewer_profile_id := NULL;
    NEW.viewer_role := 'admin';
  ELSIF private.mentor_can_access_profile(NEW.profile_id) THEN
    NEW.viewer_profile_id := active_mentor_profile_id;
    NEW.viewer_role := 'mentor';
  ELSE
    RAISE EXCEPTION 'Only admins and assigned active mentors can mark support chat read receipts.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_support_chat_read_receipt_actor() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_support_chat_read_receipt_actor
  ON public.support_chat_read_receipts;

CREATE TRIGGER trg_set_support_chat_read_receipt_actor
  BEFORE INSERT OR UPDATE ON public.support_chat_read_receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_support_chat_read_receipt_actor();

DROP POLICY IF EXISTS "Admins can audit support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Admins can audit support chat read receipts"
  ON public.support_chat_read_receipts
  FOR SELECT
  TO authenticated
  USING (private.is_support_chat_admin());

DROP POLICY IF EXISTS "Admins can upsert support chat read receipts"
  ON public.support_chat_read_receipts;
DROP POLICY IF EXISTS "Admins can insert own support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Admins can insert own support chat read receipts"
  ON public.support_chat_read_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_support_chat_admin()
    AND viewer_user_id = auth.uid()
    AND viewer_role = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update own support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Admins can update own support chat read receipts"
  ON public.support_chat_read_receipts
  FOR UPDATE
  TO authenticated
  USING (
    private.is_support_chat_admin()
    AND viewer_user_id = auth.uid()
  )
  WITH CHECK (
    private.is_support_chat_admin()
    AND viewer_user_id = auth.uid()
    AND viewer_role = 'admin'
  );

DROP POLICY IF EXISTS "Mentors can read own assigned support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Mentors can read own assigned support chat read receipts"
  ON public.support_chat_read_receipts
  FOR SELECT
  TO authenticated
  USING (
    viewer_user_id = auth.uid()
    AND private.mentor_can_access_profile(profile_id)
  );

DROP POLICY IF EXISTS "Mentors can upsert own assigned support chat read receipts"
  ON public.support_chat_read_receipts;
DROP POLICY IF EXISTS "Mentors can insert own assigned support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Mentors can insert own assigned support chat read receipts"
  ON public.support_chat_read_receipts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    viewer_user_id = auth.uid()
    AND viewer_role = 'mentor'
    AND private.mentor_can_access_profile(profile_id)
  );

DROP POLICY IF EXISTS "Mentors can update own assigned support chat read receipts"
  ON public.support_chat_read_receipts;

CREATE POLICY "Mentors can update own assigned support chat read receipts"
  ON public.support_chat_read_receipts
  FOR UPDATE
  TO authenticated
  USING (
    viewer_user_id = auth.uid()
    AND private.mentor_can_access_profile(profile_id)
  )
  WITH CHECK (
    viewer_user_id = auth.uid()
    AND viewer_role = 'mentor'
    AND private.mentor_can_access_profile(profile_id)
  );
