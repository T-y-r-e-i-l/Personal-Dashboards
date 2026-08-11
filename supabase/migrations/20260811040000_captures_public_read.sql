-- Allow anyone with the note link to read captures marked public (unlisted-by-URL).
create policy "captures_public_read"
  on public.captures
  for select
  using (visibility = 'public');

create index if not exists captures_public_id_idx
  on public.captures (id)
  where visibility = 'public';
