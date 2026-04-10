alter table public.user_profiles
  add column if not exists assigned_to_admin_id uuid references auth.users(id),
  add column if not exists is_archived boolean not null default false,
  add column if not exists last_activity_at timestamptz,
  add column if not exists whatsapp text;
