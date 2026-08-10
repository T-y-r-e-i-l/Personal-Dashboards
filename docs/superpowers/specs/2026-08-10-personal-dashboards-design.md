# Personal Dashboards — Design Spec

**Date:** 2026-08-10  
**Status:** Approved for MVP implementation

## Product
Personal Dashboards is a customizable personal life dashboard SaaS. Users own their data in Supabase (first-party). No Obsidian / vault integration in MVP.

## Stack
Next.js App Router, TypeScript, Tailwind, react-grid-layout, TanStack Query, Zustand, Supabase Auth + Postgres + RLS, Vercel.

## Architecture
- Browser app talks to Supabase for auth, layouts, and all panel data
- Weather via Next.js `/api/weather` (OpenWeatherMap key server-side only)
- No Redis, no separate Express API

## UI direction
- **Midday:** Capture-first home — greeting + full-width capture above the bento grid
- **pushr:** Extreme restraint — mono base, big numbers, soft gray surfaces
- **Life Reset OS:** Soft life-OS feel — generous radius, calm neutrals, serif display for greeting

## MVP panels
Quick Capture (home chrome), To-Do, Habits, Mood, Daily Priorities, Water, Weather, Calendar

## Out of scope
OAuth, Stripe, Google Calendar, community templates, Obsidian, mobile apps
