-- COS v14 operational profile fields.
-- These fields support CRM filtering and neutral I-539 data collection.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cos_last_entry_date date,
  ADD COLUMN IF NOT EXISTS cos_i94_number text,
  ADD COLUMN IF NOT EXISTS cos_current_status text;

COMMENT ON COLUMN public.user_profiles.cos_last_entry_date IS
  'COS v14: student-reported last U.S. entry date for operational tracking and form preparation.';

COMMENT ON COLUMN public.user_profiles.cos_i94_number IS
  'COS v14: student-reported I-94 number for operational tracking and form preparation.';

COMMENT ON COLUMN public.user_profiles.cos_current_status IS
  'COS v14: student-reported current nonimmigrant status for operational tracking and form preparation.';
