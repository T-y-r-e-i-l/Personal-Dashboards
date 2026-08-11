-- Soft-hide completed todos from the active list without deleting history.
alter table public.tasks
  add column if not exists archived_at timestamptz;

-- Index only on user_id so this works even if sort_order hasn't been migrated yet.
create index if not exists tasks_user_active_idx
  on public.tasks (user_id)
  where archived_at is null;
