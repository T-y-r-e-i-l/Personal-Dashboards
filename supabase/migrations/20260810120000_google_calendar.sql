-- Google Calendar OAuth connection (tokens only accessed via authenticated server routes)

create table if not exists public.google_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

create policy "google_calendar_connections_all_own"
  on public.google_calendar_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
