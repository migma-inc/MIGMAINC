-- Align the Placement Fee Zelle pending table with the current frontend.
-- Older remote databases already had this table, so the original
-- CREATE TABLE IF NOT EXISTS migration did not add newer columns.

alter table public.migma_placement_fee_zelle_pending
  add column if not exists migma_user_id uuid,
  add column if not exists n8n_payment_id text,
  add column if not exists n8n_response jsonb,
  add column if not exists is_2nd_installment boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists admin_notes text;

create index if not exists idx_mpfzp_application_id
  on public.migma_placement_fee_zelle_pending(application_id);

create index if not exists idx_mpfzp_profile_id
  on public.migma_placement_fee_zelle_pending(profile_id);

create index if not exists idx_mpfzp_migma_user_id
  on public.migma_placement_fee_zelle_pending(migma_user_id);

create index if not exists idx_mpfzp_status
  on public.migma_placement_fee_zelle_pending(status);

alter table public.migma_placement_fee_zelle_pending enable row level security;

drop policy if exists "Students insert own placement zelle pending"
  on public.migma_placement_fee_zelle_pending;
drop policy if exists "Students read own placement zelle pending"
  on public.migma_placement_fee_zelle_pending;
drop policy if exists "Students insert own zelle pending"
  on public.migma_placement_fee_zelle_pending;
drop policy if exists "Students read own zelle pending"
  on public.migma_placement_fee_zelle_pending;
drop policy if exists "Service role full access placement zelle pending"
  on public.migma_placement_fee_zelle_pending;
drop policy if exists "Service role full access on mpfzp"
  on public.migma_placement_fee_zelle_pending;

create policy "Students insert own placement zelle pending"
  on public.migma_placement_fee_zelle_pending
  for insert
  to authenticated
  with check (
    migma_user_id = auth.uid()
    and exists (
      select 1
      from public.user_profiles up
      where up.id = migma_placement_fee_zelle_pending.profile_id
        and up.user_id = auth.uid()
    )
  );

create policy "Students read own placement zelle pending"
  on public.migma_placement_fee_zelle_pending
  for select
  to authenticated
  using (
    migma_user_id = auth.uid()
    or exists (
      select 1
      from public.user_profiles up
      where up.id = migma_placement_fee_zelle_pending.profile_id
        and up.user_id = auth.uid()
    )
  );

create policy "Service role full access placement zelle pending"
  on public.migma_placement_fee_zelle_pending
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert on public.migma_placement_fee_zelle_pending to authenticated;
