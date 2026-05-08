-- Mentor Google Calendar OAuth + scheduling availability.
--
-- Operational prerequisites before applying remotely:
-- 1. Add the scheduling schema to Supabase Data API exposed schemas if needed.
-- 2. Deploy the Edge Functions that use the token helpers with service_role.

CREATE SCHEMA IF NOT EXISTS scheduling;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.secrets
    WHERE name = 'mentor_token_key'
  ) THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(64), 'hex'),
      'mentor_token_key',
      'Encryption key for mentor Google OAuth tokens'
    );
  END IF;
END $$;

GRANT USAGE ON SCHEMA scheduling TO authenticated, service_role;

ALTER TABLE public.referral_mentors
  ADD COLUMN IF NOT EXISTS google_account_email text,
  ADD COLUMN IF NOT EXISTS google_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS slot_duration_minutes int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_lead_hours int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS booking_window_business_days int NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_mentors_slot_duration_minutes_check'
      AND conrelid = 'public.referral_mentors'::regclass
  ) THEN
    ALTER TABLE public.referral_mentors
      ADD CONSTRAINT referral_mentors_slot_duration_minutes_check
      CHECK (slot_duration_minutes BETWEEN 10 AND 240);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_mentors_booking_lead_hours_check'
      AND conrelid = 'public.referral_mentors'::regclass
  ) THEN
    ALTER TABLE public.referral_mentors
      ADD CONSTRAINT referral_mentors_booking_lead_hours_check
      CHECK (booking_lead_hours BETWEEN 0 AND 168);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referral_mentors_booking_window_business_days_check'
      AND conrelid = 'public.referral_mentors'::regclass
  ) THEN
    ALTER TABLE public.referral_mentors
      ADD CONSTRAINT referral_mentors_booking_window_business_days_check
      CHECK (booking_window_business_days BETWEEN 1 AND 30);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION scheduling.is_admin_claim()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
    OR (auth.jwt() ->> 'role') = 'admin',
    false
  )
$$;

REVOKE ALL ON FUNCTION scheduling.is_admin_claim() FROM PUBLIC;

CREATE OR REPLACE FUNCTION scheduling.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION scheduling.tg_set_updated_at() FROM PUBLIC;

CREATE TABLE IF NOT EXISTS scheduling.mentor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.referral_mentors(profile_id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  UNIQUE (mentor_id, weekday, start_time)
);

CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor
  ON scheduling.mentor_availability(mentor_id);

CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor_weekday
  ON scheduling.mentor_availability(mentor_id, weekday, start_time);

DROP TRIGGER IF EXISTS trg_mentor_availability_updated_at ON scheduling.mentor_availability;
CREATE TRIGGER trg_mentor_availability_updated_at
  BEFORE UPDATE ON scheduling.mentor_availability
  FOR EACH ROW
  EXECUTE FUNCTION scheduling.tg_set_updated_at();

ALTER TABLE scheduling.mentor_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mentor_availability_owner_select ON scheduling.mentor_availability;
CREATE POLICY mentor_availability_owner_select
  ON scheduling.mentor_availability
  FOR SELECT
  TO authenticated
  USING (mentor_id = private.current_active_mentor_profile_id());

DROP POLICY IF EXISTS mentor_availability_owner_insert ON scheduling.mentor_availability;
CREATE POLICY mentor_availability_owner_insert
  ON scheduling.mentor_availability
  FOR INSERT
  TO authenticated
  WITH CHECK (mentor_id = private.current_active_mentor_profile_id());

DROP POLICY IF EXISTS mentor_availability_owner_update ON scheduling.mentor_availability;
CREATE POLICY mentor_availability_owner_update
  ON scheduling.mentor_availability
  FOR UPDATE
  TO authenticated
  USING (mentor_id = private.current_active_mentor_profile_id())
  WITH CHECK (mentor_id = private.current_active_mentor_profile_id());

DROP POLICY IF EXISTS mentor_availability_owner_delete ON scheduling.mentor_availability;
CREATE POLICY mentor_availability_owner_delete
  ON scheduling.mentor_availability
  FOR DELETE
  TO authenticated
  USING (mentor_id = private.current_active_mentor_profile_id());

DROP POLICY IF EXISTS mentor_availability_admin_all ON scheduling.mentor_availability;
CREATE POLICY mentor_availability_admin_all
  ON scheduling.mentor_availability
  FOR ALL
  TO authenticated
  USING (scheduling.is_admin_claim())
  WITH CHECK (scheduling.is_admin_claim());

GRANT SELECT, INSERT, UPDATE, DELETE ON scheduling.mentor_availability TO authenticated;
GRANT ALL ON scheduling.mentor_availability TO service_role;

CREATE TABLE IF NOT EXISTS scheduling.mentor_google_tokens (
  mentor_id uuid PRIMARY KEY REFERENCES public.referral_mentors(profile_id) ON DELETE CASCADE,
  refresh_token_enc bytea NOT NULL,
  access_token_enc bytea,
  access_token_expires_at timestamptz,
  scope text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_refresh_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_mentor_google_tokens_updated_at ON scheduling.mentor_google_tokens;
CREATE TRIGGER trg_mentor_google_tokens_updated_at
  BEFORE UPDATE ON scheduling.mentor_google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION scheduling.tg_set_updated_at();

ALTER TABLE scheduling.mentor_google_tokens ENABLE ROW LEVEL SECURITY;

GRANT ALL ON scheduling.mentor_google_tokens TO service_role;

CREATE OR REPLACE FUNCTION scheduling.get_token_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'mentor_token_key'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION scheduling.get_token_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION scheduling.get_token_key() TO service_role;

CREATE OR REPLACE FUNCTION scheduling.encrypt_token(plain text)
RETURNS bytea
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT extensions.pgp_sym_encrypt(plain, scheduling.get_token_key())
$$;

REVOKE ALL ON FUNCTION scheduling.encrypt_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION scheduling.encrypt_token(text) TO service_role;

CREATE OR REPLACE FUNCTION scheduling.decrypt_token(cipher bytea)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT extensions.pgp_sym_decrypt(cipher, scheduling.get_token_key())
$$;

REVOKE ALL ON FUNCTION scheduling.decrypt_token(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION scheduling.decrypt_token(bytea) TO service_role;

CREATE OR REPLACE FUNCTION scheduling.mentor_google_status(p_mentor uuid DEFAULT private.current_active_mentor_profile_id())
RETURNS TABLE (
  connected boolean,
  account_email text,
  connected_at timestamptz,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (t.mentor_id IS NOT NULL AND t.status = 'active') AS connected,
    rm.google_account_email AS account_email,
    rm.google_connected_at AS connected_at,
    COALESCE(t.status, 'disconnected') AS status
  FROM public.referral_mentors rm
  LEFT JOIN scheduling.mentor_google_tokens t
    ON t.mentor_id = rm.profile_id
  WHERE rm.profile_id = p_mentor
    AND (
      p_mentor = private.current_active_mentor_profile_id()
      OR scheduling.is_admin_claim()
    )
$$;

REVOKE ALL ON FUNCTION scheduling.mentor_google_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION scheduling.mentor_google_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION scheduling.get_mentor_schedule_config(p_mentor uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'timezone', rm.timezone,
    'slot_duration_minutes', rm.slot_duration_minutes,
    'booking_lead_hours', rm.booking_lead_hours,
    'booking_window_business_days', rm.booking_window_business_days,
    'availability', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'weekday', a.weekday,
          'start', a.start_time,
          'end', a.end_time
        )
        ORDER BY a.weekday, a.start_time
      ) FILTER (WHERE a.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM public.referral_mentors rm
  LEFT JOIN scheduling.mentor_availability a
    ON a.mentor_id = rm.profile_id
  WHERE rm.profile_id = p_mentor
    AND (
      p_mentor = private.current_active_mentor_profile_id()
      OR scheduling.is_admin_claim()
    )
  GROUP BY
    rm.profile_id,
    rm.timezone,
    rm.slot_duration_minutes,
    rm.booking_lead_hours,
    rm.booking_window_business_days
$$;

REVOKE ALL ON FUNCTION scheduling.get_mentor_schedule_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION scheduling.get_mentor_schedule_config(uuid) TO authenticated;

ALTER TABLE public.support_handoffs
  ADD COLUMN IF NOT EXISTS calendar_event_id text,
  ADD COLUMN IF NOT EXISTS meeting_calendar_link text,
  ADD COLUMN IF NOT EXISTS meeting_provider text DEFAULT 'google_meet',
  ADD COLUMN IF NOT EXISTS meeting_start timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_end timestamptz;
