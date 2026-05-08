CREATE OR REPLACE VIEW public.mentor_availability
WITH (security_invoker = true)
AS
SELECT
  id,
  mentor_id,
  weekday,
  start_time,
  end_time,
  created_at,
  updated_at
FROM scheduling.mentor_availability;

REVOKE ALL ON public.mentor_availability FROM PUBLIC;
REVOKE ALL ON public.mentor_availability FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_availability TO authenticated;

CREATE OR REPLACE FUNCTION public.mentor_google_status(p_mentor uuid)
RETURNS TABLE (
  connected boolean,
  account_email text,
  connected_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT *
  FROM scheduling.mentor_google_status(p_mentor)
$$;

REVOKE ALL ON FUNCTION public.mentor_google_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mentor_google_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mentor_google_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_mentor_schedule_config(p_mentor uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT scheduling.get_mentor_schedule_config(p_mentor)
$$;

REVOKE ALL ON FUNCTION public.get_mentor_schedule_config(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mentor_schedule_config(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_mentor_schedule_config(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.service_upsert_mentor_google_connection(
  p_mentor uuid,
  p_refresh_token text,
  p_access_token text,
  p_access_token_expires_at timestamptz,
  p_scope text,
  p_calendar_id text,
  p_google_account_email text,
  p_timezone text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO scheduling.mentor_google_tokens (
    mentor_id,
    refresh_token_enc,
    access_token_enc,
    access_token_expires_at,
    scope,
    status,
    last_refresh_error
  )
  VALUES (
    p_mentor,
    scheduling.encrypt_token(p_refresh_token),
    scheduling.encrypt_token(p_access_token),
    p_access_token_expires_at,
    p_scope,
    'active',
    NULL
  )
  ON CONFLICT (mentor_id) DO UPDATE
  SET
    refresh_token_enc = EXCLUDED.refresh_token_enc,
    access_token_enc = EXCLUDED.access_token_enc,
    access_token_expires_at = EXCLUDED.access_token_expires_at,
    scope = EXCLUDED.scope,
    status = 'active',
    last_refresh_error = NULL,
    updated_at = now();

  UPDATE public.referral_mentors
  SET
    calendar_id = p_calendar_id,
    google_account_email = p_google_account_email,
    google_connected_at = now(),
    timezone = COALESCE(NULLIF(p_timezone, ''), timezone, 'America/Sao_Paulo'),
    updated_at = now()
  WHERE profile_id = p_mentor
    AND active = true;
END;
$$;

REVOKE ALL ON FUNCTION public.service_upsert_mentor_google_connection(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_upsert_mentor_google_connection(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_upsert_mentor_google_connection(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text
) TO service_role;

CREATE OR REPLACE FUNCTION public.service_get_mentor_google_refresh_token(p_mentor uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT scheduling.decrypt_token(refresh_token_enc)
  FROM scheduling.mentor_google_tokens
  WHERE mentor_id = p_mentor
$$;

REVOKE ALL ON FUNCTION public.service_get_mentor_google_refresh_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_get_mentor_google_refresh_token(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_get_mentor_google_refresh_token(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.service_delete_mentor_google_connection(p_mentor uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM scheduling.mentor_google_tokens
  WHERE mentor_id = p_mentor;

  UPDATE public.referral_mentors
  SET
    calendar_id = NULL,
    google_account_email = NULL,
    google_connected_at = NULL,
    updated_at = now()
  WHERE profile_id = p_mentor;
END;
$$;

REVOKE ALL ON FUNCTION public.service_delete_mentor_google_connection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_delete_mentor_google_connection(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_delete_mentor_google_connection(uuid) TO service_role;
