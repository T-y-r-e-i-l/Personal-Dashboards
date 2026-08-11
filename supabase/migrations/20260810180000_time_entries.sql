-- Time tracking entries (optional link to tasks; one running timer per user)
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  description text not null default '',
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint time_entries_ended_after_start
    check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists time_entries_one_running_per_user
  on public.time_entries (user_id)
  where ended_at is null;

create index if not exists time_entries_user_started_idx
  on public.time_entries (user_id, started_at desc);

create index if not exists time_entries_task_id_idx
  on public.time_entries (task_id);

alter table public.time_entries enable row level security;

create policy "time_entries_all_own"
  on public.time_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
