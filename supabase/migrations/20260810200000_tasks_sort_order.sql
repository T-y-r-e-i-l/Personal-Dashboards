-- Persist manual to-do list order.
alter table public.tasks
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by due_date asc nulls last, created_at asc
    ) as rn
  from public.tasks
)
update public.tasks as t
set sort_order = ranked.rn
from ranked
where t.id = ranked.id;

create index if not exists tasks_user_sort_order_idx
  on public.tasks (user_id, sort_order);
