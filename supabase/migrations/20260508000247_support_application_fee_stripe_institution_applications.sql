-- Allow Application Fee Stripe sessions to map either legacy scholarship_applications
-- or the current V11 institution_applications flow.

alter table public.application_fee_stripe_sessions
  alter column scholarship_application_id drop not null;

alter table public.application_fee_stripe_sessions
  add column if not exists institution_application_id uuid
    references public.institution_applications(id) on delete cascade,
  add column if not exists application_type text;

update public.application_fee_stripe_sessions
set application_type = 'legacy'
where application_type is null;

alter table public.application_fee_stripe_sessions
  drop constraint if exists application_fee_stripe_sessions_application_type_check;

alter table public.application_fee_stripe_sessions
  add constraint application_fee_stripe_sessions_application_type_check
  check (application_type is null or application_type in ('legacy', 'institution'));

alter table public.application_fee_stripe_sessions
  drop constraint if exists application_fee_stripe_sessions_one_application_check;

alter table public.application_fee_stripe_sessions
  add constraint application_fee_stripe_sessions_one_application_check
  check (
    scholarship_application_id is not null
    or institution_application_id is not null
  );

create index if not exists idx_application_fee_stripe_sessions_institution_application_id
  on public.application_fee_stripe_sessions(institution_application_id);
