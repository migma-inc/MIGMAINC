alter table public.user_profiles
  add column if not exists selection_survey_completed_at timestamptz,
  add column if not exists selection_survey_data jsonb;
