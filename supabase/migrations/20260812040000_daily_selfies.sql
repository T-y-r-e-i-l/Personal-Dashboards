-- Daily selfie feature: profile toggle, table, private storage bucket

alter table public.profiles
  add column if not exists daily_selfie_enabled boolean not null default true;

create table if not exists public.daily_selfies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  selfie_date date not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, selfie_date)
);

create index if not exists daily_selfies_user_date_idx
  on public.daily_selfies (user_id, selfie_date desc);

alter table public.daily_selfies enable row level security;

drop policy if exists "daily_selfies_all_own" on public.daily_selfies;
create policy "daily_selfies_all_own"
  on public.daily_selfies
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-selfies',
  'daily-selfies',
  false,
  2097152, -- 2MB safety net after client compress
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "daily_selfies_insert_own" on storage.objects;
drop policy if exists "daily_selfies_select_own" on storage.objects;
drop policy if exists "daily_selfies_update_own" on storage.objects;
drop policy if exists "daily_selfies_delete_own" on storage.objects;

create policy "daily_selfies_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'daily-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "daily_selfies_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'daily-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "daily_selfies_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'daily-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'daily-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "daily_selfies_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'daily-selfies'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
