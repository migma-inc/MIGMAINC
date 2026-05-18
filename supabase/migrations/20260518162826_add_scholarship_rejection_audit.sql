alter table public.institution_applications
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id);

comment on column public.institution_applications.rejected_at is
  'Timestamp automatically recorded when a scholarship application status changes to rejected.';

comment on column public.institution_applications.rejected_by is
  'Auth user id automatically recorded when a scholarship application status changes to rejected.';

create schema if not exists private;

create or replace function private.set_institution_application_rejection_audit()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'rejected'
    and old.status is distinct from 'rejected'
  then
    new.rejected_at := now();
    new.rejected_by := auth.uid();
  end if;

  return new;
end;
$$;

revoke all on function private.set_institution_application_rejection_audit() from public;

drop trigger if exists trg_institution_application_rejection_audit
  on public.institution_applications;

create trigger trg_institution_application_rejection_audit
before update of status on public.institution_applications
for each row
execute function private.set_institution_application_rejection_audit();
