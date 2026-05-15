-- Add Initial scholarship rows for guide institutions beyond Caroline/Oikos.
-- Local migration only. Does not touch Caroline University or Oikos University.
--
-- Initial rule confirmed in Fase 5:
-- - Placement 0/200/600: bank statement USD 22,000
-- - Placement 1000/1400/1800: bank statement USD 17,000
-- - Tuition tiers: 18,000 / 10,100 / 8,840 / 7,580 / 6,320 / 5,060

create temp table initial_catalog_target_institutions (
  slug text primary key
) on commit drop;

insert into initial_catalog_target_institutions (slug) values
  ('csi-computer-systems-institute'),
  ('trine-university'),
  ('american-national-university');

update public.institutions i
set accepts_initial = true
from initial_catalog_target_institutions target
where i.slug = target.slug;

create temp table initial_catalog_tiers (
  level_num integer primary key,
  placement_fee_usd numeric not null,
  discount_percent numeric not null,
  tuition_annual_usd numeric not null,
  bank_statement_required_usd numeric not null,
  bank_statement_rule text not null,
  bank_statement_delta_usd numeric not null
) on commit drop;

insert into initial_catalog_tiers (
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
  join initial_catalog_target_institutions target on target.slug = i.slug
  join public.institution_courses c on c.institution_id = i.id
), prepared as (
  select
    tc.institution_id,
    tc.course_id,
    t.level_num,
    t.placement_fee_usd,
    t.discount_percent,
    t.tuition_annual_usd,
    round(greatest(t.tuition_annual_usd - 3800, 0) / 12.0, 2) as monthly_migma_usd,
    coalesce(tc.duration_months, 12) as installments_total,
    'Initial Nivel ' || t.level_num || ' - ' || t.discount_percent || '%' as scholarship_level,
    t.bank_statement_required_usd,
    t.bank_statement_rule,
    t.bank_statement_delta_usd
  from target_courses tc
  cross join initial_catalog_tiers t
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
  join initial_catalog_target_institutions target on target.slug = i.slug
  join public.institution_courses c on c.institution_id = i.id
), prepared as (
  select
    tc.institution_id,
    tc.course_id,
    t.level_num,
    t.placement_fee_usd,
    t.discount_percent,
    t.tuition_annual_usd,
    round(greatest(t.tuition_annual_usd - 3800, 0) / 12.0, 2) as monthly_migma_usd,
    coalesce(tc.duration_months, 12) as installments_total,
    'Initial Nivel ' || t.level_num || ' - ' || t.discount_percent || '%' as scholarship_level,
    t.bank_statement_required_usd,
    t.bank_statement_rule,
    t.bank_statement_delta_usd
  from target_courses tc
  cross join initial_catalog_tiers t
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
