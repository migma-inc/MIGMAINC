-- ============================================
-- MIGRATION: add user_profiles fields for T5, operational CRM, and survey
-- ============================================
-- Execute this SQL in the Supabase SQL Editor if the MCP is read-only.
-- Order preserved by priority:
-- 1) T5 deadline alerts
-- 2) Operational CRM fields
-- 3) Selection survey fields
-- ============================================

alter table public.user_profiles
  add column if not exists transfer_deadline_date date,
  add column if not exists cos_i94_expiry_date date;

alter table public.user_profiles
  add column if not exists assigned_to_admin_id uuid references auth.users(id),
  add column if not exists is_archived boolean not null default false,
  add column if not exists last_activity_at timestamptz,
  add column if not exists whatsapp text;

alter table public.user_profiles
  add column if not exists selection_survey_completed_at timestamptz,
  add column if not exists selection_survey_data jsonb;
