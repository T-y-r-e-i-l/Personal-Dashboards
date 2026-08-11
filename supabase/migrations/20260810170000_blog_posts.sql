-- Note visibility for public/private blog inclusion
alter table public.captures
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public'));

-- Daily LLM blog posts (one per user per local date)
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  post_date date not null,
  private_summary text not null,
  public_summary text not null,
  notes_snapshot jsonb not null default '[]'::jsonb,
  day_context jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  model text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, post_date)
);

create index if not exists blog_posts_user_date_idx
  on public.blog_posts (user_id, post_date desc);

create index if not exists blog_posts_public_idx
  on public.blog_posts (id)
  where is_public = true;

alter table public.blog_posts enable row level security;

create policy "blog_posts_owner_all"
  on public.blog_posts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "blog_posts_public_read"
  on public.blog_posts
  for select
  using (is_public = true);
