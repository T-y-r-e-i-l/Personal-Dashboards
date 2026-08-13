-- Freeze each day's dashboard panel layout for historical blog day views

create table if not exists public.dashboard_layout_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  snapshot_date date not null,
  panels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create index if not exists dashboard_layout_snapshots_user_date_idx
  on public.dashboard_layout_snapshots (user_id, snapshot_date desc);

alter table public.dashboard_layout_snapshots enable row level security;

drop policy if exists "dashboard_layout_snapshots_all_own"
  on public.dashboard_layout_snapshots;
create policy "dashboard_layout_snapshots_all_own"
  on public.dashboard_layout_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
