-- Allow multiple mood check-ins per day with timestamps.
alter table public.mood_logs
  add column if not exists logged_at timestamptz;

update public.mood_logs
set logged_at = (log_date::timestamptz + interval '12 hours')
where logged_at is null;

alter table public.mood_logs
  alter column logged_at set default now(),
  alter column logged_at set not null;

alter table public.mood_logs
  drop constraint if exists mood_logs_user_id_log_date_key;

create index if not exists mood_logs_user_log_date_idx
  on public.mood_logs (user_id, log_date);

create index if not exists mood_logs_user_logged_at_idx
  on public.mood_logs (user_id, logged_at);
