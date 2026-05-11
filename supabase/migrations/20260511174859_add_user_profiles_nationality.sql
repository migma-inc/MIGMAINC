alter table public.user_profiles
add column if not exists nationality text;

with candidates as (
  select
    up.id,
    coalesce(nullif(c.nationality, ''), nullif(vo.client_nationality, '')) as nationality
  from public.user_profiles up
  left join public.clients c
    on lower(c.email) = lower(up.email)
  left join lateral (
    select client_nationality
    from public.visa_orders vo
    where lower(vo.client_email) = lower(up.email)
      and nullif(vo.client_nationality, '') is not null
    order by vo.created_at desc
    limit 1
  ) vo on true
  where up.source = 'migma'
    and up.nationality is null
)
update public.user_profiles up
set nationality = candidates.nationality,
    updated_at = now()
from candidates
where up.id = candidates.id
  and candidates.nationality is not null;
