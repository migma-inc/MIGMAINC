-- Fase 5 Initial: suporte a elegibilidade Initial e bank statement por faixa.
-- Migration idempotente. Nao remove dados existentes.

alter table if exists public.institutions
  add column if not exists accepts_initial boolean not null default true;

alter table if exists public.institution_scholarships
  add column if not exists bank_statement_required_usd numeric;

alter table if exists public.institution_scholarships
  add column if not exists bank_statement_rule text;

alter table if exists public.institution_scholarships
  add column if not exists bank_statement_delta_usd numeric;

comment on column public.institutions.accepts_initial is
  'Indica se a instituicao pode aparecer no catalogo para alunos F-1 Initial.';

comment on column public.institution_scholarships.bank_statement_required_usd is
  'Valor final de bank statement exigido para a faixa de scholarship/placement.';

comment on column public.institution_scholarships.bank_statement_rule is
  'Regra exibida no Initial: standard, standard_plus_5000 ou reduced_minus_5000.';

comment on column public.institution_scholarships.bank_statement_delta_usd is
  'Delta aplicado ao bank statement base da instituicao para esta faixa.';

alter table if exists public.institution_scholarships
  drop constraint if exists institution_scholarships_eligibility_process_check;

alter table if exists public.institution_scholarships
  add constraint institution_scholarships_eligibility_process_check
  check (eligibility_process in ('all', 'cos', 'transfer', 'initial'));

update public.institution_scholarships s
set
  bank_statement_required_usd = coalesce(s.bank_statement_required_usd, i.bank_statement_min_usd),
  bank_statement_rule = coalesce(s.bank_statement_rule, 'standard'),
  bank_statement_delta_usd = coalesce(s.bank_statement_delta_usd, 0)
from public.institutions i
where s.institution_id = i.id
  and (
    s.bank_statement_required_usd is null
    or s.bank_statement_rule is null
    or s.bank_statement_delta_usd is null
  );

update public.institutions
set accepts_initial = true
where slug in ('caroline-university', 'oikos-university');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'visa_products'
      and column_name = 'show_in_generate_links'
  ) then
    update public.visa_products
    set
      show_in_generate_links = true,
      updated_at = now()
    where slug in (
      'initial-selection-process',
      'initial-scholarship',
      'initial-i20-control'
    );
  end if;
end $$;

create temp table initial_bachelor_tiers (
  level_num integer primary key,
  placement_fee_usd numeric not null,
  discount_percent numeric not null,
  tuition_annual_usd numeric not null,
  bank_statement_required_usd numeric not null,
  bank_statement_rule text not null,
  bank_statement_delta_usd numeric not null
) on commit drop;

insert into initial_bachelor_tiers (
  level_num,
  placement_fee_usd,
  discount_percent,
  tuition_annual_usd,
  bank_statement_required_usd,
  bank_statement_rule,
  bank_statement_delta_usd
) values
  (1, 0,    0, 18000, 22000, 'standard_plus_5000',  5000),
  (2, 200, 44, 10100, 22000, 'standard_plus_5000',  5000),
  (3, 600, 51,  8840, 22000, 'standard_plus_5000',  5000),
  (4, 1000,58,  7580, 17000, 'reduced_minus_5000', -5000),
  (5, 1400,65,  6320, 17000, 'reduced_minus_5000', -5000),
  (6, 1800,72,  5060, 17000, 'reduced_minus_5000', -5000);

with target_courses as (
  select
    i.id as institution_id,
    c.id as course_id,
    c.duration_months
  from public.institutions i
  join public.institution_courses c on c.institution_id = i.id
  where i.slug in ('caroline-university', 'oikos-university')
    and (
      c.degree_level in ('Graduação', 'Bacharelado')
      or c.course_name ilike '%bachelor%'
      or c.course_name ilike '%bacharel%'
    )
),
prepared as (
  select
    tc.institution_id,
    tc.course_id,
    t.level_num,
    t.placement_fee_usd,
    t.discount_percent,
    t.tuition_annual_usd,
    round(greatest(t.tuition_annual_usd - 3800, 0) / 12.0, 2) as monthly_migma_usd,
    coalesce(tc.duration_months, 48) as installments_total,
    'Initial Nivel ' || t.level_num || ' - ' || t.discount_percent || '%' as scholarship_level,
    t.bank_statement_required_usd,
    t.bank_statement_rule,
    t.bank_statement_delta_usd
  from target_courses tc
  cross join initial_bachelor_tiers t
)
update public.institution_scholarships s
set
  discount_percent = p.discount_percent,
  tuition_annual_usd = p.tuition_annual_usd,
  monthly_migma_usd = p.monthly_migma_usd,
  installments_total = p.installments_total,
  scholarship_level = p.scholarship_level,
  bank_statement_required_usd = p.bank_statement_required_usd,
  bank_statement_rule = p.bank_statement_rule,
  bank_statement_delta_usd = p.bank_statement_delta_usd
from prepared p
where s.institution_id = p.institution_id
  and s.course_id = p.course_id
  and s.placement_fee_usd = p.placement_fee_usd
  and s.eligibility_process = 'initial';

with target_courses as (
  select
    i.id as institution_id,
    c.id as course_id,
    c.duration_months
  from public.institutions i
  join public.institution_courses c on c.institution_id = i.id
  where i.slug in ('caroline-university', 'oikos-university')
    and (
      c.degree_level in ('Graduação', 'Bacharelado')
      or c.course_name ilike '%bachelor%'
      or c.course_name ilike '%bacharel%'
    )
),
prepared as (
  select
    tc.institution_id,
    tc.course_id,
    t.level_num,
    t.placement_fee_usd,
    t.discount_percent,
    t.tuition_annual_usd,
    round(greatest(t.tuition_annual_usd - 3800, 0) / 12.0, 2) as monthly_migma_usd,
    coalesce(tc.duration_months, 48) as installments_total,
    'Initial Nivel ' || t.level_num || ' - ' || t.discount_percent || '%' as scholarship_level,
    t.bank_statement_required_usd,
    t.bank_statement_rule,
    t.bank_statement_delta_usd
  from target_courses tc
  cross join initial_bachelor_tiers t
)
insert into public.institution_scholarships (
  institution_id,
  course_id,
  placement_fee_usd,
  discount_percent,
  tuition_annual_usd,
  monthly_migma_usd,
  installments_total,
  scholarship_level,
  eligibility_process,
  bank_statement_required_usd,
  bank_statement_rule,
  bank_statement_delta_usd
)
select
  p.institution_id,
  p.course_id,
  p.placement_fee_usd,
  p.discount_percent,
  p.tuition_annual_usd,
  p.monthly_migma_usd,
  p.installments_total,
  p.scholarship_level,
  'initial',
  p.bank_statement_required_usd,
  p.bank_statement_rule,
  p.bank_statement_delta_usd
from prepared p
where not exists (
  select 1
  from public.institution_scholarships s
  where s.institution_id = p.institution_id
    and s.course_id = p.course_id
    and s.placement_fee_usd = p.placement_fee_usd
    and s.eligibility_process = 'initial'
);
