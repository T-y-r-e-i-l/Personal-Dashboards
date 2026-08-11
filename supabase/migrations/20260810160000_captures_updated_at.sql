-- Track edits on quick captures so timestamps reflect last change.
alter table public.captures
  add column if not exists updated_at timestamptz not null default now();

update public.captures
set updated_at = created_at;

create index if not exists captures_user_updated_at_idx
  on public.captures (user_id, updated_at desc);
