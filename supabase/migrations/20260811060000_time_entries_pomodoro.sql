-- Pomodoro metadata on time entries (stopwatch leaves planned_seconds null)
alter table public.time_entries
  add column if not exists timer_mode text not null default 'stopwatch',
  add column if not exists planned_seconds integer;

alter table public.time_entries
  drop constraint if exists time_entries_timer_mode_check;

alter table public.time_entries
  add constraint time_entries_timer_mode_check
  check (timer_mode in ('stopwatch', 'focus', 'short_break', 'long_break'));

alter table public.time_entries
  drop constraint if exists time_entries_planned_seconds_check;

alter table public.time_entries
  add constraint time_entries_planned_seconds_check
  check (planned_seconds is null or planned_seconds > 0);
