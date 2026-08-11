-- Private storage for capture/note media attachments

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-media',
  'note-media',
  false,
  20971520, -- 20MB
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "note_media_insert_own" on storage.objects;
drop policy if exists "note_media_select_own" on storage.objects;
drop policy if exists "note_media_update_own" on storage.objects;
drop policy if exists "note_media_delete_own" on storage.objects;

create policy "note_media_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_media_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_media_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note_media_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'note-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
