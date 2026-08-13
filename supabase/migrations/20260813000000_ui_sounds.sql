-- UI sound effects: profile toggle, bindings table, private storage bucket

alter table public.profiles
  add column if not exists ui_sounds_enabled boolean not null default false;

create table if not exists public.ui_sound_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null,
  storage_path text not null,
  original_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slot)
);

create index if not exists ui_sound_bindings_user_idx
  on public.ui_sound_bindings (user_id);

alter table public.ui_sound_bindings enable row level security;

drop policy if exists "ui_sound_bindings_all_own" on public.ui_sound_bindings;
create policy "ui_sound_bindings_all_own"
  on public.ui_sound_bindings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ui-sounds',
  'ui-sounds',
  false,
  2097152, -- 2MB
  array[
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "ui_sounds_insert_own" on storage.objects;
drop policy if exists "ui_sounds_select_own" on storage.objects;
drop policy if exists "ui_sounds_update_own" on storage.objects;
drop policy if exists "ui_sounds_delete_own" on storage.objects;

create policy "ui_sounds_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ui-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ui_sounds_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ui-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ui_sounds_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'ui-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'ui-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "ui_sounds_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ui-sounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
