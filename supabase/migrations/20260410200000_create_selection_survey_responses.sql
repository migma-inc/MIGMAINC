-- Migration: create selection_survey_responses
-- Stores the detailed answers of the post-checkout questionnaire (v7 spec).
-- Operational summary fields are mirrored to user_profiles for CRM access without joins.

CREATE TABLE IF NOT EXISTS public.selection_survey_responses (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id              UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service_type            TEXT        NOT NULL CHECK (service_type IN ('transfer', 'cos', 'initial', 'eb2', 'eb3')),

  -- Operational fields extracted for CRM queries (mirrors user_profiles on save)
  academic_formation      TEXT,         -- Certificate | Bacharelado | Mestrado
  interest_areas          TEXT[],       -- exactly 2 values
  class_frequency         TEXT[],       -- exactly 2 values
  annual_investment       TEXT[],       -- exactly 2 ranges
  preferred_regions       TEXT[],       -- exactly 3 US states
  english_level           TEXT,         -- Zero | Básico | Intermediário | Avançado | Fluente
  main_objective          TEXT,
  weekly_availability     TEXT,
  transfer_deadline_date  DATE,         -- Transfer only
  cos_i94_expiry_date     DATE,         -- COS only

  -- Full answers blob (all question IDs → values)
  answers                 JSONB        NOT NULL DEFAULT '{}'::jsonb,

  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One response per profile per service_type (upsert-safe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_selection_survey_responses_profile_service
  ON public.selection_survey_responses(profile_id, service_type);

CREATE INDEX IF NOT EXISTS idx_selection_survey_responses_profile_id
  ON public.selection_survey_responses(profile_id);

CREATE INDEX IF NOT EXISTS idx_selection_survey_responses_completed_at
  ON public.selection_survey_responses(completed_at)
  WHERE completed_at IS NOT NULL;

-- RLS
ALTER TABLE public.selection_survey_responses ENABLE ROW LEVEL SECURITY;

-- Authenticated user can read/write their own response
CREATE POLICY "student can manage own survey response"
  ON public.selection_survey_responses
  FOR ALL
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can read all responses
CREATE POLICY "admin can read all survey responses"
  ON public.selection_survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
