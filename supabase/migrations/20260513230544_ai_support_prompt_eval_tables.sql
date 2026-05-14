create schema if not exists private;

create table if not exists private.ai_support_prompt_eval_cases (
  id text primary key,
  name text not null,
  group_name text,
  input_json jsonb not null,
  expected_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.ai_support_prompt_eval_runs (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  prompt_sha256 text,
  prompt_chars integer,
  total integer not null default 0,
  passed integer not null default 0,
  failed integer not null default 0,
  source text not null default 'n8n',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint ai_support_prompt_eval_runs_status_check
    check (status in ('running', 'completed', 'failed'))
);

create table if not exists private.ai_support_prompt_eval_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references private.ai_support_prompt_eval_runs(id) on delete cascade,
  case_id text not null references private.ai_support_prompt_eval_cases(id) on delete restrict,
  passed boolean not null,
  output_json jsonb,
  raw_output text,
  checks_json jsonb not null default '[]'::jsonb,
  failed_checks jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (run_id, case_id)
);

create index if not exists ai_support_prompt_eval_cases_enabled_idx
  on private.ai_support_prompt_eval_cases (enabled, group_name, id);

create index if not exists ai_support_prompt_eval_runs_started_at_idx
  on private.ai_support_prompt_eval_runs (started_at desc);

create index if not exists ai_support_prompt_eval_results_run_id_idx
  on private.ai_support_prompt_eval_results (run_id, passed, case_id);

create or replace function private.set_ai_support_prompt_eval_case_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_support_prompt_eval_case_updated_at
  on private.ai_support_prompt_eval_cases;

create trigger set_ai_support_prompt_eval_case_updated_at
before update on private.ai_support_prompt_eval_cases
for each row
execute function private.set_ai_support_prompt_eval_case_updated_at();

comment on table private.ai_support_prompt_eval_cases is
  'Synthetic QA cases for MIGMA support prompt evaluation. Not production student data.';

comment on table private.ai_support_prompt_eval_runs is
  'Prompt evaluation executions for MIGMA support AI.';

comment on table private.ai_support_prompt_eval_results is
  'Per-case output and assertions for each MIGMA support prompt evaluation run.';
