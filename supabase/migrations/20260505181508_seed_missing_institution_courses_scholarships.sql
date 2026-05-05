-- Seed de cursos e bolsas faltantes a partir de:
-- C:\Users\pcxyz\OneDrive\Área de Trabalho\MIGMA-project\Guia_Instituicoes_Educacionais_PT.md
--
-- Premissas:
-- - Migration idempotente: atualiza registros existentes e insere apenas o que falta.
-- - Nao remove bolsas antigas sem course_id para nao quebrar historico de applications.
-- - Bolsas antigas globais ficam ocultas no front quando ha bolsas especificas por curso.
-- - AAE/ALA/Excel/ILI/Internexus preservam a classificacao atual da spec v12/banco
--   (esl_flag = false), apesar de o guia novo agrupa-las em "Escolas de Ingles".
-- - Tabelas ESL usam tuition mensal no guia; aqui tuition_annual_usd recebe mensal * 12.
-- - ANU possui tabela distinta para Transfer; eligibility_process separa COS/Transfer.

alter table if exists public.institution_scholarships
  add column if not exists course_id uuid references public.institution_courses(id) on delete cascade;

alter table if exists public.institution_scholarships
  add column if not exists scholarship_level text;

alter table if exists public.institution_scholarships
  add column if not exists eligibility_process text;

update public.institution_scholarships
set eligibility_process = 'all'
where eligibility_process is null;

alter table if exists public.institution_scholarships
  alter column eligibility_process set default 'all',
  alter column eligibility_process set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'institution_scholarships_eligibility_process_check'
  ) then
    alter table public.institution_scholarships
      add constraint institution_scholarships_eligibility_process_check
      check (eligibility_process in ('all', 'cos', 'transfer'));
  end if;
end $$;

create temp table seed_institutions (
  slug text primary key,
  name text not null,
  city text not null,
  state text not null,
  modality text not null,
  cpt_opt text not null,
  application_fee_usd numeric not null,
  bank_statement_min_usd numeric not null,
  bank_stmt_per_dep_usd numeric not null,
  esl_flag boolean not null,
  accepts_cos boolean not null,
  accepts_transfer boolean not null
) on commit drop;

insert into seed_institutions (
  slug, name, city, state, modality, cpt_opt, application_fee_usd,
  bank_statement_min_usd, bank_stmt_per_dep_usd, esl_flag, accepts_cos, accepts_transfer
) values
  ('csi-computer-systems-institute', 'CSI — Computer Systems Institute', 'Boston / Chicago', 'MA / IL', 'Híbrido ou Presencial', 'CPT após 9 meses', 150, 13160, 3000, false, true, true),
  ('trine-university', 'Trine University', 'Detroit / Phoenix / Reston', 'MI / AZ / VA', 'Híbrido', 'CPT desde o 1º dia', 350, 22000, 4000, false, true, true),
  ('american-national-university', 'American National University', 'Salem / Nashville / Louisville', 'VA / TN / KY', 'Híbrido', 'CPT por programa', 350, 28000, 5000, false, true, true),
  ('uceda-school-orlando', 'Uceda School — Orlando', 'Orlando', 'FL', 'Presencial', 'Não aplicável', 350, 17520, 3600, true, true, true),
  ('uceda-school-boca-raton', 'Uceda School — Boca Raton', 'Boca Raton', 'FL', 'Presencial', 'Não aplicável', 350, 17520, 3600, true, true, true),
  ('uceda-school-elizabeth', 'Uceda School — Elizabeth / Long Branch', 'Elizabeth / Long Branch', 'NJ', 'Presencial', 'Não aplicável', 350, 17520, 3600, true, true, true),
  ('uceda-school-las-vegas', 'Uceda School — Las Vegas', 'Las Vegas', 'NV', 'Presencial', 'Não aplicável', 350, 17520, 3600, true, true, true),
  ('aae-san-francisco', 'AAE — San Francisco', 'San Francisco', 'CA', 'Presencial', 'Não aplicável', 350, 17520, 3600, false, true, true),
  ('csi-esl', 'CSI — ESL', 'Boston / Chicago', 'MA / IL', 'Presencial', 'Não aplicável', 350, 11250, 3000, true, true, true),
  ('excel-dallas', 'Excel — Dallas', 'Dallas', 'TX', 'Presencial', 'Não aplicável', 350, 21120, 3600, false, true, true),
  ('ili-washington', 'ILI — Washington', 'Washington', 'MD', 'Presencial', 'Não aplicável', 350, 21360, 3600, false, true, true),
  ('ala-charlotte', 'ALA — Charlotte', 'Charlotte', 'NC', 'Presencial', 'Não aplicável', 350, 18240, 3600, false, true, true),
  ('internexus-provo', 'Internexus — Provo', 'Provo', 'UT', 'Presencial', 'Não aplicável', 350, 17664, 3600, false, true, true);

insert into public.institutions (
  name, slug, city, state, modality, cpt_opt, application_fee_usd,
  bank_statement_min_usd, bank_stmt_per_dep_usd, esl_flag, accepts_cos, accepts_transfer
)
select
  name, slug, city, state, modality, cpt_opt, application_fee_usd,
  bank_statement_min_usd, bank_stmt_per_dep_usd, esl_flag, accepts_cos, accepts_transfer
from seed_institutions si
where not exists (
  select 1
  from public.institutions i
  where i.slug = si.slug
);

update public.institutions i
set
  name = si.name,
  city = si.city,
  state = si.state,
  modality = si.modality,
  cpt_opt = si.cpt_opt,
  application_fee_usd = si.application_fee_usd,
  bank_statement_min_usd = si.bank_statement_min_usd,
  bank_stmt_per_dep_usd = si.bank_stmt_per_dep_usd,
  esl_flag = si.esl_flag,
  accepts_cos = si.accepts_cos,
  accepts_transfer = si.accepts_transfer
from seed_institutions si
where i.slug = si.slug;

-- Normaliza cursos genericos antigos para evitar opcoes sem bolsa especifica no modal.
update public.institution_courses c
set
  course_name = 'Business Career Program – Fundamentals Concentration',
  area = 'Negócios & Gestão',
  degree_level = 'Certificado',
  duration_months = 12,
  cpt_after_months = 9
from public.institutions i
where c.institution_id = i.id
  and i.slug = 'csi-computer-systems-institute'
  and c.course_name = 'Business Career Program';

update public.institution_courses c
set
  course_name = 'Mestrado em Administração de Empresas',
  area = 'Negócios & Gestão',
  degree_level = 'Mestrado',
  duration_months = 24,
  cpt_after_months = 0
from public.institutions i
where c.institution_id = i.id
  and i.slug = 'trine-university'
  and c.course_name = 'MBA - Master of Business Administration';

create temp table seed_courses (
  slug text not null,
  course_name text not null,
  area text not null,
  degree_level text not null,
  duration_months integer,
  cpt_after_months integer,
  scholarship_table_key text not null,
  primary key (slug, course_name)
) on commit drop;

insert into seed_courses (
  slug, course_name, area, degree_level, duration_months, cpt_after_months, scholarship_table_key
) values
  ('csi-computer-systems-institute', 'Business Career Program – Fundamentals Concentration', 'Negócios & Gestão', 'Certificado', 12, 9, 'csi_bcp_standard'),
  ('csi-computer-systems-institute', 'Business Career Program – Digital Multimedia Concentration', 'Exatas & Tecnologia', 'Certificado', 12, 9, 'csi_digital'),
  ('csi-computer-systems-institute', 'Business Career Program – Finance Concentration', 'Negócios & Gestão', 'Certificado', 12, 9, 'csi_bcp_standard'),
  ('csi-computer-systems-institute', 'Business Career Program – Marketing Concentration', 'Negócios & Gestão', 'Certificado', 12, 9, 'csi_bcp_standard'),
  ('csi-computer-systems-institute', 'Business Career Program – Hospitality Leadership Concentration', 'Hospitalidade', 'Certificado', 12, 9, 'csi_bcp_standard'),
  ('csi-computer-systems-institute', 'Business Career Program – Organizational Administration Concentration', 'Negócios & Gestão', 'Certificado', 12, 9, 'csi_bcp_standard'),
  ('csi-computer-systems-institute', 'Customer Service Specialist Program (CSS)', 'Atendimento ao Cliente', 'Certificado', 12, 0, 'csi_css'),
  ('csi-computer-systems-institute', 'Networking Career Program – Web Development Concentration', 'Exatas & Tecnologia', 'Certificado', 12, null, 'csi_web'),
  ('trine-university', 'Mestrado em Administração de Empresas', 'Negócios & Gestão', 'Mestrado', 24, 0, 'trine_masters'),
  ('trine-university', 'Mestrado em Análise de Negócios', 'Negócios & Gestão', 'Mestrado', 24, 0, 'trine_masters'),
  ('trine-university', 'Mestrado em Gestão de Engenharia', 'Exatas & Tecnologia', 'Mestrado', 24, 0, 'trine_masters'),
  ('trine-university', 'Mestrado em Estudos da Informação', 'Exatas & Tecnologia', 'Mestrado', 24, 0, 'trine_masters'),
  ('american-national-university', 'Bacharelado em Administração de Empresas e Gestão', 'Negócios & Gestão', 'Graduação', 48, 9, 'anu_cos'),
  ('american-national-university', 'Bacharelado em Cibersegurança', 'Exatas & Tecnologia', 'Graduação', 48, 9, 'anu_cos'),
  ('american-national-university', 'Mestrado em Administração (ênfase em IT)', 'Negócios & Gestão', 'Mestrado', 24, 0, 'anu_cos'),
  ('american-national-university', 'Mestrado em Healthcare Management', 'Saúde & Ciências', 'Mestrado', 24, 0, 'anu_cos'),
  ('american-national-university', 'Mestrado em Cibersegurança', 'Exatas & Tecnologia', 'Mestrado', 24, 0, 'anu_cos'),
  ('american-national-university', 'Mestrado em Tecnologia da Informação', 'Exatas & Tecnologia', 'Mestrado', 24, 0, 'anu_cos'),
  ('uceda-school-orlando', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'uceda_orlando_elizabeth'),
  ('uceda-school-boca-raton', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'uceda_boca'),
  ('uceda-school-elizabeth', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'uceda_orlando_elizabeth'),
  ('uceda-school-las-vegas', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'uceda_las_vegas'),
  ('aae-san-francisco', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'aae_monthly'),
  ('csi-esl', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 8, null, 'csi_esl_monthly'),
  ('excel-dallas', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'excel_monthly'),
  ('ili-washington', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'ili_monthly'),
  ('ala-charlotte', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'ala_monthly'),
  ('internexus-provo', 'English as a Second Language (ESL)', 'Inglês', 'ESL', 12, null, 'internexus_monthly');

insert into public.institution_courses (
  institution_id, course_name, area, degree_level, duration_months, cpt_after_months
)
select
  i.id, sc.course_name, sc.area, sc.degree_level, sc.duration_months, sc.cpt_after_months
from seed_courses sc
join public.institutions i on i.slug = sc.slug
where not exists (
  select 1
  from public.institution_courses c
  where c.institution_id = i.id
    and c.course_name = sc.course_name
);

update public.institution_courses c
set
  area = sc.area,
  degree_level = sc.degree_level,
  duration_months = sc.duration_months,
  cpt_after_months = sc.cpt_after_months
from seed_courses sc
join public.institutions i on i.slug = sc.slug
where c.institution_id = i.id
  and c.course_name = sc.course_name;

create temp table seed_scholarship_tiers (
  scholarship_table_key text not null,
  level_num integer not null,
  placement_fee_usd numeric not null,
  discount_percent numeric not null,
  tuition_value numeric not null,
  tuition_period text not null check (tuition_period in ('annual', 'monthly')),
  eligibility_process text not null check (eligibility_process in ('all', 'cos', 'transfer')),
  primary key (scholarship_table_key, level_num)
) on commit drop;

insert into seed_scholarship_tiers (
  scholarship_table_key, level_num, placement_fee_usd, discount_percent, tuition_value, tuition_period, eligibility_process
) values
  ('csi_bcp_standard', 1, 0, 0, 15000, 'annual', 'all'),
  ('csi_bcp_standard', 2, 200, 11, 13380, 'annual', 'all'),
  ('csi_bcp_standard', 3, 600, 19, 12120, 'annual', 'all'),
  ('csi_bcp_standard', 4, 1000, 28, 10860, 'annual', 'all'),
  ('csi_bcp_standard', 5, 1400, 36, 9600, 'annual', 'all'),
  ('csi_bcp_standard', 6, 1800, 44, 8340, 'annual', 'all'),
  ('csi_digital', 1, 0, 0, 15000, 'annual', 'all'),
  ('csi_digital', 2, 200, 13, 13060, 'annual', 'all'),
  ('csi_digital', 3, 600, 21, 11800, 'annual', 'all'),
  ('csi_digital', 4, 1000, 30, 10540, 'annual', 'all'),
  ('csi_digital', 5, 1400, 38, 9280, 'annual', 'all'),
  ('csi_digital', 6, 1800, 47, 8020, 'annual', 'all'),
  ('csi_css', 1, 0, 0, 15000, 'annual', 'all'),
  ('csi_css', 2, 200, 14, 12900, 'annual', 'all'),
  ('csi_css', 3, 600, 22, 11640, 'annual', 'all'),
  ('csi_css', 4, 1000, 31, 10380, 'annual', 'all'),
  ('csi_css', 5, 1400, 39, 9120, 'annual', 'all'),
  ('csi_css', 6, 1800, 48, 7860, 'annual', 'all'),
  ('csi_web', 1, 0, 0, 15000, 'annual', 'all'),
  ('csi_web', 2, 200, 9, 13660, 'annual', 'all'),
  ('csi_web', 3, 600, 17, 12400, 'annual', 'all'),
  ('csi_web', 4, 1000, 26, 11140, 'annual', 'all'),
  ('csi_web', 5, 1400, 34, 9880, 'annual', 'all'),
  ('csi_web', 6, 1800, 43, 8620, 'annual', 'all'),
  ('trine_masters', 1, 0, 0, 15000, 'annual', 'all'),
  ('trine_masters', 2, 200, 11, 13300, 'annual', 'all'),
  ('trine_masters', 3, 600, 20, 12040, 'annual', 'all'),
  ('trine_masters', 4, 1000, 28, 10780, 'annual', 'all'),
  ('trine_masters', 5, 1400, 37, 9520, 'annual', 'all'),
  ('trine_masters', 6, 1800, 45, 8260, 'annual', 'all'),
  ('anu_cos', 1, 0, 0, 15000, 'annual', 'cos'),
  ('anu_cos', 2, 200, 0, 15150, 'annual', 'cos'),
  ('anu_cos', 3, 600, 7, 13890, 'annual', 'cos'),
  ('anu_cos', 4, 1000, 16, 12630, 'annual', 'cos'),
  ('anu_cos', 5, 1400, 24, 11370, 'annual', 'cos'),
  ('anu_cos', 6, 1800, 32, 10110, 'annual', 'cos'),
  ('anu_transfer', 1, 0, 0, 15000, 'annual', 'transfer'),
  ('anu_transfer', 2, 200, 4, 14400, 'annual', 'transfer'),
  ('anu_transfer', 3, 600, 12, 13140, 'annual', 'transfer'),
  ('anu_transfer', 4, 1000, 21, 11880, 'annual', 'transfer'),
  ('anu_transfer', 5, 1400, 29, 10620, 'annual', 'transfer'),
  ('anu_transfer', 6, 1800, 38, 9360, 'annual', 'transfer'),
  ('uceda_orlando_elizabeth', 1, 0, 0, 1250, 'monthly', 'all'),
  ('uceda_orlando_elizabeth', 2, 200, 24, 945, 'monthly', 'all'),
  ('uceda_orlando_elizabeth', 3, 600, 33, 840, 'monthly', 'all'),
  ('uceda_orlando_elizabeth', 4, 1000, 41, 735, 'monthly', 'all'),
  ('uceda_orlando_elizabeth', 5, 1400, 50, 630, 'monthly', 'all'),
  ('uceda_orlando_elizabeth', 6, 1800, 58, 525, 'monthly', 'all'),
  ('uceda_boca', 1, 0, 0, 1300, 'monthly', 'all'),
  ('uceda_boca', 2, 200, 24, 988, 'monthly', 'all'),
  ('uceda_boca', 3, 600, 32, 883, 'monthly', 'all'),
  ('uceda_boca', 4, 1000, 40, 778, 'monthly', 'all'),
  ('uceda_boca', 5, 1400, 48, 673, 'monthly', 'all'),
  ('uceda_boca', 6, 1800, 56, 568, 'monthly', 'all'),
  ('uceda_las_vegas', 1, 0, 0, 1400, 'monthly', 'all'),
  ('uceda_las_vegas', 2, 200, 20, 1120, 'monthly', 'all'),
  ('uceda_las_vegas', 3, 600, 27, 1015, 'monthly', 'all'),
  ('uceda_las_vegas', 4, 1000, 35, 910, 'monthly', 'all'),
  ('uceda_las_vegas', 5, 1400, 42, 805, 'monthly', 'all'),
  ('uceda_las_vegas', 6, 1800, 50, 700, 'monthly', 'all'),
  ('aae_monthly', 1, 0, 0, 1350, 'monthly', 'all'),
  ('aae_monthly', 2, 200, 23, 1045, 'monthly', 'all'),
  ('aae_monthly', 3, 600, 30, 940, 'monthly', 'all'),
  ('aae_monthly', 4, 1000, 38, 835, 'monthly', 'all'),
  ('aae_monthly', 5, 1400, 46, 730, 'monthly', 'all'),
  ('aae_monthly', 6, 1800, 54, 625, 'monthly', 'all'),
  ('csi_esl_monthly', 1, 0, 0, 1200, 'monthly', 'all'),
  ('csi_esl_monthly', 2, 200, 25, 900, 'monthly', 'all'),
  ('csi_esl_monthly', 3, 600, 33, 800, 'monthly', 'all'),
  ('csi_esl_monthly', 4, 1000, 41, 700, 'monthly', 'all'),
  ('csi_esl_monthly', 5, 1400, 50, 600, 'monthly', 'all'),
  ('csi_esl_monthly', 6, 1800, 58, 500, 'monthly', 'all'),
  ('excel_monthly', 1, 0, 0, 1600, 'monthly', 'all'),
  ('excel_monthly', 2, 200, 19, 1290, 'monthly', 'all'),
  ('excel_monthly', 3, 600, 26, 1185, 'monthly', 'all'),
  ('excel_monthly', 4, 1000, 32, 1080, 'monthly', 'all'),
  ('excel_monthly', 5, 1400, 39, 975, 'monthly', 'all'),
  ('excel_monthly', 6, 1800, 45, 870, 'monthly', 'all'),
  ('ili_monthly', 1, 0, 0, 1650, 'monthly', 'all'),
  ('ili_monthly', 2, 200, 19, 1340, 'monthly', 'all'),
  ('ili_monthly', 3, 600, 25, 1235, 'monthly', 'all'),
  ('ili_monthly', 4, 1000, 32, 1130, 'monthly', 'all'),
  ('ili_monthly', 5, 1400, 38, 1025, 'monthly', 'all'),
  ('ili_monthly', 6, 1800, 44, 920, 'monthly', 'all'),
  ('ala_monthly', 1, 0, 0, 1250, 'monthly', 'all'),
  ('ala_monthly', 2, 200, 23, 960, 'monthly', 'all'),
  ('ala_monthly', 3, 600, 32, 855, 'monthly', 'all'),
  ('ala_monthly', 4, 1000, 40, 750, 'monthly', 'all'),
  ('ala_monthly', 5, 1400, 48, 645, 'monthly', 'all'),
  ('ala_monthly', 6, 1800, 57, 540, 'monthly', 'all'),
  ('internexus_monthly', 1, 0, 0, 1280, 'monthly', 'all'),
  ('internexus_monthly', 2, 200, 23, 990, 'monthly', 'all'),
  ('internexus_monthly', 3, 600, 31, 885, 'monthly', 'all'),
  ('internexus_monthly', 4, 1000, 39, 780, 'monthly', 'all'),
  ('internexus_monthly', 5, 1400, 47, 675, 'monthly', 'all'),
  ('internexus_monthly', 6, 1800, 55, 570, 'monthly', 'all');

create temp table seed_course_scholarship_map as
select
  sc.slug,
  sc.course_name,
  sc.scholarship_table_key
from seed_courses sc;

-- ANU usa uma tabela alternativa para Transfer.
insert into seed_course_scholarship_map (slug, course_name, scholarship_table_key)
select slug, course_name, 'anu_transfer'
from seed_courses
where slug = 'american-national-university';

with prepared_scholarships as (
  select
    i.id as institution_id,
    c.id as course_id,
    st.level_num,
    st.placement_fee_usd,
    st.discount_percent,
    case
      when st.tuition_period = 'monthly' then st.tuition_value * 12
      else st.tuition_value
    end as tuition_annual_usd,
    case
      when st.tuition_period = 'monthly' then st.tuition_value
      else round(st.tuition_value / 12.0, 2)
    end as monthly_migma_usd,
    case
      when st.tuition_period = 'monthly' then 12
      else coalesce(c.duration_months, 12)
    end as installments_total,
    'Nível ' || st.level_num || ' - ' || st.discount_percent || '%' as scholarship_level,
    st.eligibility_process
  from seed_course_scholarship_map scm
  join seed_scholarship_tiers st on st.scholarship_table_key = scm.scholarship_table_key
  join public.institutions i on i.slug = scm.slug
  join public.institution_courses c
    on c.institution_id = i.id
   and c.course_name = scm.course_name
)
update public.institution_scholarships s
set
  discount_percent = ps.discount_percent,
  tuition_annual_usd = ps.tuition_annual_usd,
  monthly_migma_usd = ps.monthly_migma_usd,
  installments_total = ps.installments_total,
  scholarship_level = ps.scholarship_level,
  eligibility_process = ps.eligibility_process
from prepared_scholarships ps
where s.institution_id = ps.institution_id
  and s.course_id is not distinct from ps.course_id
  and s.placement_fee_usd = ps.placement_fee_usd
  and s.eligibility_process = ps.eligibility_process;

with prepared_scholarships as (
  select
    i.id as institution_id,
    c.id as course_id,
    st.level_num,
    st.placement_fee_usd,
    st.discount_percent,
    case
      when st.tuition_period = 'monthly' then st.tuition_value * 12
      else st.tuition_value
    end as tuition_annual_usd,
    case
      when st.tuition_period = 'monthly' then st.tuition_value
      else round(st.tuition_value / 12.0, 2)
    end as monthly_migma_usd,
    case
      when st.tuition_period = 'monthly' then 12
      else coalesce(c.duration_months, 12)
    end as installments_total,
    'Nível ' || st.level_num || ' - ' || st.discount_percent || '%' as scholarship_level,
    st.eligibility_process
  from seed_course_scholarship_map scm
  join seed_scholarship_tiers st on st.scholarship_table_key = scm.scholarship_table_key
  join public.institutions i on i.slug = scm.slug
  join public.institution_courses c
    on c.institution_id = i.id
   and c.course_name = scm.course_name
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
  eligibility_process
)
select
  ps.institution_id,
  ps.course_id,
  ps.placement_fee_usd,
  ps.discount_percent,
  ps.tuition_annual_usd,
  ps.monthly_migma_usd,
  ps.installments_total,
  ps.scholarship_level,
  ps.eligibility_process
from prepared_scholarships ps
where not exists (
  select 1
  from public.institution_scholarships s
  where s.institution_id = ps.institution_id
    and s.course_id is not distinct from ps.course_id
    and s.placement_fee_usd = ps.placement_fee_usd
    and s.eligibility_process = ps.eligibility_process
);

create index if not exists idx_institution_courses_institution_id
  on public.institution_courses (institution_id);

create index if not exists idx_institution_scholarships_institution_id
  on public.institution_scholarships (institution_id);

create index if not exists idx_institution_scholarships_course_id
  on public.institution_scholarships (course_id);

create index if not exists idx_institution_scholarships_catalog_lookup
  on public.institution_scholarships (
    institution_id,
    course_id,
    eligibility_process,
    placement_fee_usd
  );

with expected_discount(slug, course_name, placement_fee_usd, discount_percent) as (
  values
    ('caroline-university', 'Bachelor of Business Administration', 0, 0),
    ('caroline-university', 'Bachelor of Business Administration', 200, 33),
    ('caroline-university', 'Bachelor of Business Administration', 600, 41),
    ('caroline-university', 'Bachelor of Business Administration', 1000, 49),
    ('caroline-university', 'Bachelor of Business Administration', 1400, 58),
    ('caroline-university', 'Bachelor of Business Administration', 1800, 70),
    ('caroline-university', 'MBA / Business Analytics / Filosofia', 0, 0),
    ('caroline-university', 'MBA / Business Analytics / Filosofia', 200, 33),
    ('caroline-university', 'MBA / Business Analytics / Filosofia', 600, 41),
    ('caroline-university', 'MBA / Business Analytics / Filosofia', 1000, 49),
    ('caroline-university', 'MBA / Business Analytics / Filosofia', 1400, 58),
    ('caroline-university', 'MBA / Business Analytics / Filosofia', 1800, 70),
    ('caroline-university', 'MS in Computer Science', 0, 0),
    ('caroline-university', 'MS in Computer Science', 200, 28),
    ('caroline-university', 'MS in Computer Science', 600, 36),
    ('caroline-university', 'MS in Computer Science', 1000, 45),
    ('caroline-university', 'MS in Computer Science', 1400, 53),
    ('caroline-university', 'MS in Computer Science', 1800, 62)
)
update public.institution_scholarships s
set
  discount_percent = ed.discount_percent,
  scholarship_level =
    'Nível ' ||
    case ed.placement_fee_usd
      when 0 then 1
      when 200 then 2
      when 600 then 3
      when 1000 then 4
      when 1400 then 5
      when 1800 then 6
    end ||
    ' - ' || ed.discount_percent || '%'
from expected_discount ed
join public.institutions i on i.slug = ed.slug
join public.institution_courses c
  on c.institution_id = i.id
 and c.course_name = ed.course_name
where s.institution_id = i.id
  and s.course_id = c.id
  and s.placement_fee_usd = ed.placement_fee_usd
  and s.eligibility_process = 'all';
