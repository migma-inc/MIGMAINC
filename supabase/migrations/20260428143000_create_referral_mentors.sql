-- Explicit mentor registry for the student referral landing flow.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mentor_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS calendar_booking_url text;

CREATE TABLE IF NOT EXISTS public.referral_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  calendar_booking_url text,
  calendar_id text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_mentors_profile_id_unique UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_mentors_active
  ON public.referral_mentors(active);

CREATE INDEX IF NOT EXISTS idx_user_profiles_mentor_id
  ON public.user_profiles(mentor_id);

ALTER TABLE public.referral_mentors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read referral mentors" ON public.referral_mentors;
CREATE POLICY "Admins can read referral mentors"
  ON public.referral_mentors
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
  );

DROP POLICY IF EXISTS "Admins can manage referral mentors" ON public.referral_mentors;
CREATE POLICY "Admins can manage referral mentors"
  ON public.referral_mentors
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin')
  );

DROP POLICY IF EXISTS "Users can manage own referral mentor profile" ON public.referral_mentors;
CREATE POLICY "Users can manage own referral mentor profile"
  ON public.referral_mentors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = referral_mentors.profile_id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = referral_mentors.profile_id
        AND up.user_id = auth.uid()
    )
  );

INSERT INTO public.referral_mentors (profile_id, display_name, calendar_booking_url, active)
SELECT
  up.id,
  COALESCE(NULLIF(up.full_name, ''), up.email, up.id::text),
  up.calendar_booking_url,
  true
FROM public.user_profiles up
WHERE up.calendar_booking_url IS NOT NULL
  AND btrim(up.calendar_booking_url) <> ''
ON CONFLICT (profile_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  calendar_booking_url = EXCLUDED.calendar_booking_url,
  active = true,
  updated_at = now();
