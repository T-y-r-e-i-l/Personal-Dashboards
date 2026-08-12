-- Retro Macintosh UI theme preference on profiles

alter table public.profiles
  add column if not exists retro_ui_enabled boolean not null default false;
