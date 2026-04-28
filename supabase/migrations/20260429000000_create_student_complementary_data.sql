-- Migration: student_complementary_data
-- Stores complementary data collected after application fee payment (spec v11, section 11.4)

create table if not exists public.student_complementary_data (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.user_profiles(id) on delete cascade,

  -- Emergency contact
  emergency_contact_name        text not null default '',
  emergency_contact_phone       text not null default '',
  emergency_contact_relationship text not null default '',
  emergency_contact_address     text,

  -- Program start preference
  preferred_start_term          text, -- e.g. 'Spring 2026'

  -- Financial sponsor
  has_sponsor                   boolean not null default false,
  sponsor_name                  text,
  sponsor_relationship          text,
  sponsor_phone                 text,
  sponsor_address               text,
  sponsor_employer              text,
  sponsor_job_title             text,
  sponsor_years_employed        integer,
  sponsor_annual_income         text,
  sponsor_committed_amount_usd  numeric,

  -- Work experience (up to 3 entries)
  -- Each entry: { company: string, period: string, role: string }
  work_experience               jsonb not null default '[]'::jsonb,

  -- Recommenders
  recommender1_name             text,
  recommender1_role             text,
  recommender1_contact          text,
  recommender2_name             text,
  recommender2_role             text,
  recommender2_contact          text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.student_complementary_data enable row level security;

-- Student can read/write their own record
create policy "student_complementary_data_own"
  on public.student_complementary_data
  for all
  using (
    profile_id in (
      select id from public.user_profiles where user_id = auth.uid()
    )
  );

-- Admin full access
create policy "student_complementary_data_admin"
  on public.student_complementary_data
  for all
  using (
    ((auth.jwt() -> 'user_metadata'::text) ->> 'role'::text) = ANY (ARRAY['admin'::text, 'super_admin'::text, 'superadmin'::text])
  );

-- updated_at trigger
create or replace function public.set_updated_at_complementary()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_complementary_data_updated_at
  before update on public.student_complementary_data
  for each row execute function public.set_updated_at_complementary();
