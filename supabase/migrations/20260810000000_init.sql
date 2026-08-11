-- Ghost Writer MVP schema

create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Los_Angeles',
  location text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dashboards
create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboards_user_id_idx on public.dashboards (user_id);

-- Dashboard panels (grid layout)
create table if not exists public.dashboard_panels (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  panel_type text not null,
  config jsonb not null default '{}'::jsonb,
  x integer not null default 0,
  y integer not null default 0,
  w integer not null default 2,
  h integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_panels_dashboard_id_idx on public.dashboard_panels (dashboard_id);
create index if not exists dashboard_panels_user_id_idx on public.dashboard_panels (user_id);

-- Captures
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  tags text[] not null default '{}',
  priority text check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists captures_user_id_idx on public.captures (user_id);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'todo' check (status in ('todo', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- Habits
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habit_logs_user_id_idx on public.habit_logs (user_id);

-- Mood
create table if not exists public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  mood integer not null check (mood between 1 and 10),
  energy integer check (energy between 1 and 10),
  stress integer check (stress between 1 and 10),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists mood_logs_user_id_idx on public.mood_logs (user_id);

-- Daily priorities
create table if not exists public.daily_priorities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  tier text not null check (tier in ('must', 'should', 'nice')),
  done boolean not null default false,
  priority_date date not null default (current_date),
  created_at timestamptz not null default now()
);

create index if not exists daily_priorities_user_id_idx on public.daily_priorities (user_id);

-- Water
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null default (current_date),
  glasses integer not null default 0 check (glasses >= 0),
  goal integer not null default 8 check (goal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists water_logs_user_id_idx on public.water_logs (user_id);

-- Calendar events
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_user_id_idx on public.calendar_events (user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.dashboards enable row level security;
alter table public.dashboard_panels enable row level security;
alter table public.captures enable row level security;
alter table public.tasks enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.mood_logs enable row level security;
alter table public.daily_priorities enable row level security;
alter table public.water_logs enable row level security;
alter table public.calendar_events enable row level security;

-- Profiles policies
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Generic user_id policies
create policy "dashboards_all_own" on public.dashboards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dashboard_panels_all_own" on public.dashboard_panels for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "captures_all_own" on public.captures for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_all_own" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_all_own" on public.habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_logs_all_own" on public.habit_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mood_logs_all_own" on public.mood_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_priorities_all_own" on public.daily_priorities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "water_logs_all_own" on public.water_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calendar_events_all_own" on public.calendar_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
