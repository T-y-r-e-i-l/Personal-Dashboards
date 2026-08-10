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

2. Apply the SQL migration in `supabase/migrations/20260810000000_init.sql` to your Supabase project (SQL editor or CLI).

3. Install and run:

```bash
npm install
npm run dev
```

4. Optional: set `OPENWEATHER_API_KEY` for live weather. Without it, `/api/weather` returns a demo payload.

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
- Drag/resize bento grid with persisted layout
