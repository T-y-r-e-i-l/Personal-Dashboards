# Personal Dashboards

A calm, capture-first personal dashboard built with Next.js and Supabase.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase Auth + Postgres (RLS)
- react-grid-layout, TanStack Query, Zustand, Recharts

## Setup

1. Copy env file and fill values:

```bash
cp .env.local.example .env.local
```

2. Apply SQL migrations in `supabase/migrations/` to your Supabase project (SQL editor or CLI), including:
   - `20260810000000_init.sql`
   - `20260810120000_google_calendar.sql`
   - `20260810140000_note_media_storage.sql` (capture media uploads)
   - `20260810160000_captures_updated_at.sql`
   - `20260810170000_blog_posts.sql` (note visibility + daily blog posts)

3. Install and run:

```bash
npm install
npm run dev
```

4. Optional: set `OPENWEATHER_API_KEY` for live weather. Without it, `/api/weather` returns a demo payload.

5. Optional — Google Calendar sync:
   - Create an OAuth 2.0 Web client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Enable the **Google Calendar API**
   - Authorized redirect URI: `http://localhost:3000/api/google/callback`
   - Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXT_PUBLIC_APP_URL` in `.env.local`
   - In the app: **Settings → Connect Google Calendar**

6. Optional — Daily LLM blog:
   - Set `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY`
   - Optional `BLOG_MODEL` (default `openai/gpt-4.1-mini`)
   - Deploy on Vercel so the hourly cron in `vercel.json` can hit `/api/cron/daily-blog` (generates when local hour is 23)
   - Mark notes Public/Private in Quick Capture; publish posts from **Blog** → day page → share `/p/[id]`

## Scripts

- `npm run dev` — local app
- `npm run build` — production build
- `npm run test:unit` — habit/mood/water helpers
- `npm run test:e2e` — Playwright landing + weather API checks

## MVP features

- Email/password auth
- Onboarding templates (Morning, Work, Weekly, Blank)
- Capture-first home
- Panels: Tasks, Habits, Mood, Priorities, Water, Weather, Calendar
- Google Calendar sync (read-only) for today's events
- Drag/resize bento grid with persisted layout
- Daily LLM blog (auto end-of-day summary + original notes; public/private notes)
