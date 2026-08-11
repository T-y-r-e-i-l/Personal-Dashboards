-- Persist manual habit list order.
alter table public.habits
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at asc
    ) as rn
  from public.habits
)
update public.habits as h
set sort_order = ranked.rn
from ranked
where h.id = ranked.id;

create index if not exists habits_user_sort_order_idx
  on public.habits (user_id, sort_order);
