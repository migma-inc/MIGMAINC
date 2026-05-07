-- Harden Migma Checkout Zelle approval queue.
--
-- This table is written by students when they submit a Zelle receipt in
-- MigmaCheckout, but approval/rejection must be an admin-only operation.
-- The previous policies allowed every authenticated user to read and update
-- every row because the admin UI updated the table directly.

alter table public.migma_checkout_zelle_pending
  add column if not exists migma_user_name text,
  add column if not exists migma_user_email text,
  add column if not exists is_test boolean not null default false;

alter table public.migma_checkout_zelle_pending enable row level security;

drop policy if exists "Authenticated users can update zelle pending"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Authenticated users can select all zelle pending"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Students insert own zelle pending"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Students read own zelle pending"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Users can insert their own pending payments"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Users can view their own pending payments"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Students update own pending zelle metadata"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Admins can read zelle pending"
  on public.migma_checkout_zelle_pending;
drop policy if exists "Zelle approvers can read zelle pending"
  on public.migma_checkout_zelle_pending;

create policy "Students insert own zelle pending"
  on public.migma_checkout_zelle_pending
  for insert
  to authenticated
  with check (migma_user_id = auth.uid());

create policy "Students read own zelle pending"
  on public.migma_checkout_zelle_pending
  for select
  to authenticated
  using (migma_user_id = auth.uid());

create policy "Students update own pending zelle metadata"
  on public.migma_checkout_zelle_pending
  for update
  to authenticated
  using (
    migma_user_id = auth.uid()
    and status = 'pending_verification'
  )
  with check (
    migma_user_id = auth.uid()
    and status = 'pending_verification'
  );

-- Read-only approver access is kept for CRM surfaces that still query the table
-- directly. Mutations are intentionally not exposed through RLS anymore; admin
-- approval/rejection now goes through the migma-checkout-zelle-admin function.
create policy "Zelle approvers can read zelle pending"
  on public.migma_checkout_zelle_pending
  for select
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in (
      'admin',
      'superadmin',
      'super_admin',
      'seller',
      'head_of_sale',
      'head_of_sales'
    )
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'superadmin', 'super_admin')
    or exists (
      select 1
      from public.sellers s
      where s.user_id = auth.uid()
        and s.status = 'active'
        and s.role in ('seller', 'head_of_sale', 'head_of_sales')
    )
  );

revoke update on public.migma_checkout_zelle_pending from authenticated;
grant select, insert on public.migma_checkout_zelle_pending to authenticated;
grant update (
  n8n_payment_id,
  image_path,
  receipt_url,
  n8n_response,
  n8n_confidence,
  updated_at
) on public.migma_checkout_zelle_pending to authenticated;
