# Day Dashboard — Design Spec

## Goal

Each day is a navigable **day dashboard**: LLM digest (when present) above a read-only reconstruction of the user’s current panel grid filled with that day’s data, plus that day’s notes. Live editing stays on Today (`/dashboard`).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Historical panels | Reconstruct from date-filtered live data (not a frozen digest-only UI) |
| Days without a digest | Still navigable; summary optional / empty state |
| Navigation model | Hybrid: Today = live `/dashboard`; history = day UI at `/blog/[date]` |
| Grid layout | Current default dashboard `dashboard_panels` layout |
| Data fill | Date-parameterized panel queries |
| Public share | `/p/[id]` unchanged (public summary + public notes only) |

## Routes & navigation

### Today

- `/dashboard` remains the live, editable home: Quick Capture + interactive grid for **today** (user timezone).

### Day view

- `/blog/[date]` is the day dashboard for `YYYY-MM-DD` (**any** calendar day, not only rows in `blog_posts`).
- `/blog` remains a lightweight archive index (existing posts) linking into day dashboards.

### Day chrome

- Formatted date label.
- Previous / next day (±1 calendar day in user timezone).
- Date input / picker to jump to any day.
- If `date === today`: show **Open live Today** → `/dashboard` (day view for today is read-only reconstruct, not a second editor).
- If a `blog_posts` row exists: keep publish controls (`PublishToggle`) in the chrome.
- Sidebar: keep **Today** and **Blog**.

### Public

- `/p/[id]` unchanged for v1.

## Page layout (`/blog/[date]`)

Top → bottom:

1. **Day chrome** — date, prev/next, picker, optional publish.
2. **LLM summary** — if post exists: `private_summary` (Markdown). Else quiet empty state (“No digest yet”); do not block the page.
3. **Grid** — current default dashboard’s panels (same types/positions as live Today), **read-only**, bound to `date`.
4. **Notes** — that day’s `captures` in timezone-local day range; Caveat / notes styling; visibility badges as today.

### Demote

- Primary UI no longer centers on collapsible raw `DaySignals`; the grid replaces that role. Signals UI may be removed or kept secondary later; not required for v1 day dashboard.

## Panel behavior (day view)

- Pass `date: string` (`YYYY-MM-DD`) and `readOnly: true` into panels.
- Query that local day from existing tables (completed tasks, habit logs, mood, water, priorities, calendar for the day range, time entries overlapping the day, etc.).
- No add/edit/complete/timer, no layout drag, no Add panel.
- Empty panels still render with an empty state (layout preserved).
- **Weather:** prefer `blog_posts.day_context.weather` when a post exists; otherwise show unavailable for past days (live weather only makes sense for today).
- **Calendar:** Google events for that day’s UTC range when connected; empty/unavailable otherwise.

## Today path (unchanged contract)

- Panels omit `date` / `readOnly` → behave as today: editable, live queries.
- Quick Capture stays on `/dashboard` only (not on day view).

## Data loading

Day view loads:

- Auth user + `profiles.timezone` (and location if needed).
- Optional `blog_posts` for `(user_id, post_date)`.
- Default dashboard’s `dashboard_panels` (current layout).
- Notes: `captures` with `created_at` in `[startUtc, endUtc)` for that local day (same bounds idea as `getDayRange` / `collectDayContext`). Prefer live captures over `notes_snapshot` so days without a post still show notes.

Invalid `date` → not found or redirect to `/blog`.

## Implementation shape

### Shared UI

- New day shell component (e.g. `DayDashboard`) used by `/blog/[date]`.
- `DashboardGrid` (or equivalent) supports modes: `interactive` (Today) vs `readonly` + `date` (day view).

### Panel contract

- Each panel accepts optional `date?: string` and `readOnly?: boolean`.
- Defaults preserve Today behavior when omitted.
- React Query keys include `date` where relevant.

### Notes UI

- Reuse capture list presentation (Caveat via existing notes styles); read-only (no inline edit on day view for v1).

## Out of scope (v1)

- Editing past days (tasks, habits, notes, layout).
- Snapshotting panel layout/values into `blog_posts` at digest time.
- Full grid on public `/p/[id]`.
- On-demand digest generation from the day UI.
- Merging Blog and Today into a single route tree.

## Success criteria

- User can open any calendar day and see summary (if any), their current panel layout filled for that day, and that day’s notes.
- Today remains the only fully interactive dashboard.
- Days without a digest are first-class, not dead ends.
- Prev/next and date picker make day browsing effortless.
