-- Sleep logs: one night per user per wake/sleep_date.
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sleep_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  score integer not null check (score >= 0 and score <= 100),
  rating text not null check (rating in ('poor', 'fair', 'good', 'excellent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sleep_date),
  constraint sleep_logs_ended_after_start check (ended_at > started_at)
);

create index if not exists sleep_logs_user_id_idx on public.sleep_logs (user_id);
create index if not exists sleep_logs_user_sleep_date_idx
  on public.sleep_logs (user_id, sleep_date);

alter table public.sleep_logs enable row level security;

create policy "sleep_logs_all_own"
  on public.sleep_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
