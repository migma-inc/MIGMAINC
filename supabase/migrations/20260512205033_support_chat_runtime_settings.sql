-- Runtime routing for student support chat.
-- This keeps AI/human routing out of build-time environment variables.

CREATE TABLE IF NOT EXISTS public.support_chat_runtime_settings (
  id text PRIMARY KEY DEFAULT 'default',
  ai_enabled boolean NOT NULL DEFAULT false,
  human_timeout_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT support_chat_runtime_settings_singleton_check CHECK (id = 'default'),
  CONSTRAINT support_chat_runtime_settings_timeout_check CHECK (
    human_timeout_minutes BETWEEN 1 AND 1440
  )
);

INSERT INTO public.support_chat_runtime_settings (id, ai_enabled, human_timeout_minutes)
VALUES ('default', false, 60)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.support_chat_runtime_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_chat_runtime_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.support_chat_runtime_settings TO authenticated;

CREATE OR REPLACE FUNCTION private.set_support_chat_runtime_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  NEW.id := 'default';
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_support_chat_runtime_settings_audit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_set_support_chat_runtime_settings_audit
  ON public.support_chat_runtime_settings;

CREATE TRIGGER trg_set_support_chat_runtime_settings_audit
  BEFORE UPDATE ON public.support_chat_runtime_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.set_support_chat_runtime_settings_audit();

DROP POLICY IF EXISTS "Authenticated can read support chat runtime settings"
  ON public.support_chat_runtime_settings;

CREATE POLICY "Authenticated can read support chat runtime settings"
  ON public.support_chat_runtime_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update support chat runtime settings"
  ON public.support_chat_runtime_settings;

CREATE POLICY "Admins can update support chat runtime settings"
  ON public.support_chat_runtime_settings
  FOR UPDATE
  TO authenticated
  USING (private.is_support_chat_admin())
  WITH CHECK (private.is_support_chat_admin());
