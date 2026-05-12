-- Allow admins and assigned mentors to reply in the student support chat.
-- Adds sender metadata for display/audit and prevents students from spoofing
-- human team roles in support_chat_messages.

ALTER TABLE public.support_chat_messages
  ADD COLUMN IF NOT EXISTS sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sender_display_name text,
  ADD COLUMN IF NOT EXISTS sender_role_label text;

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_sender_user
  ON public.support_chat_messages(sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_sender_profile
  ON public.support_chat_messages(sender_profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION private.set_support_chat_message_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  active_mentor_profile_id uuid;
  derived_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to insert support chat messages.';
  END IF;

  NEW.sender_display_name := NULLIF(BTRIM(COALESCE(NEW.sender_display_name, '')), '');
  NEW.sender_role_label := NULLIF(BTRIM(COALESCE(NEW.sender_role_label, '')), '');

  IF NEW.role = 'mentor' THEN
    IF NOT private.mentor_can_access_profile(NEW.profile_id) THEN
      RAISE EXCEPTION 'Only assigned active mentors can send mentor support chat messages.';
    END IF;

    active_mentor_profile_id := private.current_active_mentor_profile_id();

    SELECT rm.display_name
      INTO derived_name
    FROM public.referral_mentors rm
    WHERE rm.profile_id = active_mentor_profile_id
      AND rm.active = true
    LIMIT 1;

    NEW.sender_user_id := auth.uid();
    NEW.sender_profile_id := active_mentor_profile_id;
    NEW.sender_display_name := COALESCE(NEW.sender_display_name, derived_name, 'Migma Mentor');
    NEW.sender_role_label := COALESCE(NEW.sender_role_label, 'Mentor');
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin' THEN
    IF NOT private.is_support_chat_admin() THEN
      RAISE EXCEPTION 'Only admins can send admin support chat messages.';
    END IF;

    SELECT COALESCE(
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'name'), ''),
      NULLIF(BTRIM(u.email), '')
    )
      INTO derived_name
    FROM auth.users u
    WHERE u.id = auth.uid();

    NEW.sender_user_id := auth.uid();
    NEW.sender_profile_id := NULL;
    NEW.sender_display_name := COALESCE(NEW.sender_display_name, derived_name, 'Migma Team');
    NEW.sender_role_label := COALESCE(NEW.sender_role_label, 'Migma Team');
    RETURN NEW;
  END IF;

  IF NEW.role = 'user' THEN
    SELECT COALESCE(
      NULLIF(BTRIM(up.full_name), ''),
      NULLIF(BTRIM(up.email), ''),
      'Student'
    )
      INTO derived_name
    FROM public.user_profiles up
    WHERE up.id = NEW.profile_id;

    NEW.sender_user_id := auth.uid();
    NEW.sender_profile_id := NEW.profile_id;
    NEW.sender_display_name := COALESCE(NEW.sender_display_name, derived_name, 'Student');
    NEW.sender_role_label := COALESCE(NEW.sender_role_label, 'Student');
    RETURN NEW;
  END IF;

  IF NEW.role = 'assistant' THEN
    NEW.sender_user_id := NULL;
    NEW.sender_profile_id := NULL;
    NEW.sender_display_name := COALESCE(NEW.sender_display_name, 'Migma AI Assistant');
    NEW.sender_role_label := COALESCE(NEW.sender_role_label, 'AI Assistant');
    RETURN NEW;
  END IF;

  IF NEW.role = 'system' THEN
    IF private.is_support_chat_admin() THEN
      NEW.sender_user_id := auth.uid();
      NEW.sender_profile_id := NULL;
    ELSIF private.mentor_can_access_profile(NEW.profile_id) THEN
      NEW.sender_user_id := auth.uid();
      NEW.sender_profile_id := private.current_active_mentor_profile_id();
    ELSE
      NEW.sender_user_id := NULL;
      NEW.sender_profile_id := NULL;
    END IF;

    NEW.sender_display_name := COALESCE(NEW.sender_display_name, 'Migma System');
    NEW.sender_role_label := COALESCE(NEW.sender_role_label, 'System');
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unsupported support chat role: %', NEW.role;
END;
$$;

REVOKE ALL ON FUNCTION private.set_support_chat_message_sender() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_support_chat_message_sender
  ON public.support_chat_messages;

CREATE TRIGGER trg_set_support_chat_message_sender
  BEFORE INSERT ON public.support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION private.set_support_chat_message_sender();

DROP POLICY IF EXISTS "Admins can insert support chat"
  ON public.support_chat_messages;

CREATE POLICY "Admins can insert support chat"
  ON public.support_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_support_chat_admin()
    AND role IN ('admin', 'system')
  );

DROP POLICY IF EXISTS "Mentors can insert assigned support chat"
  ON public.support_chat_messages;

CREATE POLICY "Mentors can insert assigned support chat"
  ON public.support_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.mentor_can_access_profile(profile_id)
    AND role IN ('mentor', 'system')
  );

DROP POLICY IF EXISTS "Students can insert own support chat"
  ON public.support_chat_messages;

CREATE POLICY "Students can insert own support chat"
  ON public.support_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role IN ('user', 'assistant', 'system')
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = support_chat_messages.profile_id
        AND up.user_id = auth.uid()
    )
  );
