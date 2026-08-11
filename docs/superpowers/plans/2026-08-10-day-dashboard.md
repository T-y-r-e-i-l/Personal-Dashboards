# Day Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/blog/[date]` into a navigable day dashboard: optional LLM summary, read-only grid using the current panel layout filled for that date, plus that day’s notes — while `/dashboard` stays the live editable Today.

**Architecture:** Extend `dayRange` helpers for arbitrary `YYYY-MM-DD`. Add a client `DayDashboard` shell that loads optional `blog_posts`, default `dashboard_panels`, and day-bounded notes. Teach `DashboardGrid` a `readOnly` + `date` mode and give each panel optional `date` / `readOnly` (and weather snapshot when present). Today path keeps omitting those props.

**Tech Stack:** Next.js App Router, Supabase, TanStack Query, react-grid-layout, date-fns, existing Caveat notes styles, node:test unit tests via `npm run test:unit`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-10-day-dashboard-design.md`
- Any calendar day is navigable (digest optional)
- Historical grid uses **current** default dashboard layout
- Day view is **read-only**; Quick Capture only on `/dashboard`
- Public `/p/[id]` unchanged
- Prefer live `captures` for notes (not only `notes_snapshot`)
- Weather on past days: prefer `day_context.weather` when a post exists; else unavailable
- Do not invent on-demand digest generation or past-day editing in v1

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/blog/dayRange.ts` | `getDayRangeForDate`, `shiftPostDate`, `isValidPostDate` |
| `src/lib/blog/dayRange.test.ts` | Unit tests for new helpers |
| `src/lib/blog/parseDayContext.ts` | Safe parse of `day_context` weather (small helper) |
| `src/components/blog/DayChrome.tsx` | Prev/next, date picker, links, optional publish slot |
| `src/components/blog/DayNotesList.tsx` | Read-only notes list (Caveat) |
| `src/components/blog/DayDashboard.tsx` | Client shell: summary + grid + notes |
| `src/components/dashboard/DashboardGrid.tsx` | `readOnly` / `date` / `weatherSnapshot` mode |
| `src/components/panels/*.tsx` | Accept `date?`, `readOnly?`; hide mutations when read-only |
| `src/lib/time/entries.ts` | Optional: export bounds helper using day range (or call `getDayRangeForDate` from panel) |
| `src/app/(app)/blog/[date]/page.tsx` | Server load any day + render `DayDashboard` |
| `src/app/(app)/blog/page.tsx` | Archive copy + entry to browse “today’s day view” / any day |

---

### Task 1: Day-range helpers for arbitrary dates

**Files:**
- Modify: `src/lib/blog/dayRange.ts`
- Modify: `src/lib/blog/dayRange.test.ts`

**Interfaces:**
- Produces:
  - `isValidPostDate(value: string): boolean` — `YYYY-MM-DD` with real calendar date
  - `getDayRangeForDate(timeZone: string, postDate: string): DayRange` — same shape as `getDayRange` (`postDate`, `startUtc`, `endUtc`, `localHour` can be `0` at start-of-day)
  - `shiftPostDate(postDate: string, deltaDays: number): string` — calendar arithmetic on the date string (UTC midnight of Y-M-D components)

- [ ] **Step 1: Write failing tests**

Append to `src/lib/blog/dayRange.test.ts`:

```ts
import {
  formatPostDateTitle,
  getDayRange,
  getDayRangeForDate,
  isValidPostDate,
  shiftPostDate,
} from "@/lib/blog/dayRange";

describe("isValidPostDate", () => {
  it("accepts real dates and rejects junk", () => {
    assert.equal(isValidPostDate("2026-08-10"), true);
    assert.equal(isValidPostDate("2026-02-30"), false);
    assert.equal(isValidPostDate("08-10-2026"), false);
  });
});

describe("getDayRangeForDate", () => {
  it("matches getDayRange postDate bounds for that local day", () => {
    const now = new Date("2026-08-11T06:30:00.000Z"); // 2026-08-10 evening PDT
    const fromNow = getDayRange("America/Los_Angeles", now);
    const fromDate = getDayRangeForDate("America/Los_Angeles", "2026-08-10");
    assert.equal(fromDate.postDate, "2026-08-10");
    assert.equal(fromDate.startUtc, fromNow.startUtc);
    assert.equal(fromDate.endUtc, fromNow.endUtc);
  });
});

describe("shiftPostDate", () => {
  it("moves across month boundaries", () => {
    assert.equal(shiftPostDate("2026-08-01", -1), "2026-07-31");
    assert.equal(shiftPostDate("2026-08-10", 1), "2026-08-11");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- --test-name-pattern "isValidPostDate|getDayRangeForDate|shiftPostDate"`
Expected: FAIL (exports missing)

- [ ] **Step 3: Implement helpers in `dayRange.ts`**

Reuse existing private `zonedTimeToUtc` / `addCalendarDays`. Implementation sketch:

```ts
export function isValidPostDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function getDayRangeForDate(
  timeZone: string,
  postDate: string,
): DayRange {
  if (!isValidPostDate(postDate)) {
    throw new Error(`Invalid postDate: ${postDate}`);
  }
  const [year, month, day] = postDate.split("-").map(Number);
  const start = zonedTimeToUtc(year, month, day, 0, 0, timeZone);
  const next = addCalendarDays(year, month, day, 1);
  const end = zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone);
  return {
    postDate,
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    localHour: 0,
  };
}

export function shiftPostDate(postDate: string, deltaDays: number): string {
  if (!isValidPostDate(postDate)) {
    throw new Error(`Invalid postDate: ${postDate}`);
  }
  const [year, month, day] = postDate.split("-").map(Number);
  const next = addCalendarDays(year, month, day, deltaDays);
  return `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}-${String(next.day).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog/dayRange.ts src/lib/blog/dayRange.test.ts
git commit -m "Add day-range helpers for arbitrary post dates."
```

---

### Task 2: Parse `day_context` weather safely

**Files:**
- Create: `src/lib/blog/parseDayContext.ts`
- Create: `src/lib/blog/parseDayContext.test.ts`

**Interfaces:**
- Consumes: `DayContext["weather"]` from `src/lib/blog/types.ts`
- Produces: `parseDayContextWeather(raw: unknown): DayContext["weather"] | null`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDayContextWeather } from "@/lib/blog/parseDayContext";

describe("parseDayContextWeather", () => {
  it("returns weather object when present", () => {
    const weather = parseDayContextWeather({
      weather: { location: "SF", temp: 68, description: "clear" },
    });
    assert.deepEqual(weather, {
      location: "SF",
      temp: 68,
      description: "clear",
    });
  });

  it("returns null for junk", () => {
    assert.equal(parseDayContextWeather(null), null);
    assert.equal(parseDayContextWeather({}), null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test src/lib/blog/parseDayContext.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement**

```ts
import type { DayContext } from "@/lib/blog/types";

export function parseDayContextWeather(
  raw: unknown,
): DayContext["weather"] | null {
  if (!raw || typeof raw !== "object") return null;
  const weather = (raw as { weather?: unknown }).weather;
  if (!weather || typeof weather !== "object") return null;
  const w = weather as Record<string, unknown>;
  if (
    typeof w.location !== "string" ||
    typeof w.temp !== "number" ||
    typeof w.description !== "string"
  ) {
    return null;
  }
  return {
    location: w.location,
    temp: w.temp,
    description: w.description,
  };
}
```

- [ ] **Step 4: Wire into `package.json` `test:unit` script** (add the new test file path)

- [ ] **Step 5: Run tests + commit**

```bash
npm run test:unit
git add src/lib/blog/parseDayContext.ts src/lib/blog/parseDayContext.test.ts package.json
git commit -m "Add safe day_context weather parser."
```

---

### Task 3: `DayChrome` navigation UI

**Files:**
- Create: `src/components/blog/DayChrome.tsx`

**Interfaces:**
- Consumes: `shiftPostDate`, `isValidPostDate`, `formatPostDateTitle`
- Produces: `<DayChrome date timezone todayDate postId? isPublic? children?(publish slot) />`

- [ ] **Step 1: Implement client component**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatPostDateTitle,
  isValidPostDate,
  shiftPostDate,
} from "@/lib/blog/dayRange";
import { PublishToggle } from "@/components/blog/PublishToggle";

export function DayChrome({
  date,
  todayDate,
  postId,
  isPublic,
}: {
  date: string;
  todayDate: string;
  postId?: string | null;
  isPublic?: boolean;
}) {
  const router = useRouter();
  const prev = shiftPostDate(date, -1);
  const next = shiftPostDate(date, 1);

  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <Link
          href="/blog"
          className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Blog
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {formatPostDateTitle(date)}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/blog/${prev}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
          >
            Previous
          </Link>
          <Link
            href={`/blog/${next}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
          >
            Next
          </Link>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              if (isValidPostDate(v)) router.push(`/blog/${v}`);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            aria-label="Jump to date"
          />
          {date === todayDate ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)]"
            >
              Open live Today
            </Link>
          ) : null}
        </div>
      </div>
      {postId ? (
        <PublishToggle postId={postId} initialPublic={Boolean(isPublic)} />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Manual smoke** — import compiles (`npx tsc --noEmit` or rely on next build later)

- [ ] **Step 3: Commit**

```bash
git add src/components/blog/DayChrome.tsx
git commit -m "Add day chrome with prev/next and date picker."
```

---

### Task 4: Read-only `DayNotesList`

**Files:**
- Create: `src/components/blog/DayNotesList.tsx`

**Interfaces:**
- Produces: `<DayNotesList notes={{ id, content, visibility, created_at }[]} />`

- [ ] **Step 1: Implement** — extract the notes list markup currently in `blog/[date]/page.tsx` (Caveat / `notes-hand`, time + visibility). Empty state: “No notes captured this day.”

- [ ] **Step 2: Commit**

```bash
git add src/components/blog/DayNotesList.tsx
git commit -m "Add read-only day notes list component."
```

---

### Task 5: `DashboardGrid` read-only + date mode

**Files:**
- Modify: `src/components/dashboard/DashboardGrid.tsx`

**Interfaces:**
- Consumes: panel components updated in Tasks 6–7 (pass props through now; panels ignore unknown until updated)
- Produces: props extension:

```ts
{
  // existing...
  readOnly?: boolean;
  date?: string; // YYYY-MM-DD
  weatherSnapshot?: { location: string; temp: number; description: string } | null;
}
```

- [ ] **Step 1: Extend `renderPanel` and grid props**

```ts
function renderPanel(
  type: PanelType,
  userId: string,
  location: string | null,
  config: PanelConfig,
  options: {
    date?: string;
    readOnly?: boolean;
    weatherSnapshot?: { location: string; temp: number; description: string } | null;
  },
) {
  const common = {
    userId,
    date: options.date,
    readOnly: options.readOnly,
  };
  switch (type) {
    case "tasks":
      return <TasksPanel {...common} />;
    case "habits":
      return <HabitsPanel {...common} />;
    case "mood":
      return <MoodPanel {...common} />;
    case "priorities":
      return <PrioritiesPanel {...common} />;
    case "water":
      return <WaterPanel {...common} />;
    case "weather":
      return (
        <WeatherPanel
          {...common}
          location={config.location || location}
          weatherSnapshot={options.weatherSnapshot}
        />
      );
    case "calendar":
      return <CalendarPanel {...common} />;
    case "time":
      return <TimeTrackingPanel {...common} />;
    default:
      return null;
  }
}
```

When `readOnly`:

- Disable drag/resize (`dragConfig.enabled: false`, `resizeConfig.enabled: false`)
- Omit `onConfigure` / `onRemove` on `PanelChrome`
- Skip `PanelConfigModal`
- `onLayoutChange` can be a no-op from parent; still guard inside handler if `readOnly`
- Mobile accordion can remain (expand/collapse for reading)

- [ ] **Step 2: Keep Today call sites unchanged** (`DashboardHome` does not pass `readOnly` / `date`)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardGrid.tsx
git commit -m "Support read-only dated mode on dashboard grid."
```

---

### Task 6: Date + readOnly for log-date panels (mood, water, priorities, habits)

**Files:**
- Modify: `src/components/panels/MoodPanel.tsx`
- Modify: `src/components/panels/WaterPanel.tsx`
- Modify: `src/components/panels/PrioritiesPanel.tsx`
- Modify: `src/components/panels/HabitsPanel.tsx`

**Interfaces:**
- Consumes: `date?: string`, `readOnly?: boolean`
- Behavior: `const day = date ?? format(new Date(), "yyyy-MM-dd")`; include `day` in query keys; when `readOnly`, hide add/toggle/increment controls and disable mutations UI

- [ ] **Step 1: MoodPanel** — use `day` instead of `today` for “selected day” log; week window ends at `day` (`subDays(parseISO(day), 6)` … `day`). Hide save controls when `readOnly`.

- [ ] **Step 2: WaterPanel** — query/upsert `log_date = day`; hide +1 controls when `readOnly`.

- [ ] **Step 3: PrioritiesPanel** — `priority_date = day`; hide add/toggle when `readOnly`.

- [ ] **Step 4: HabitsPanel** — streak/week relative to `day`; toggle only when `!readOnly`.

- [ ] **Step 5: Smoke Today** — omit props still editable for “today” browser date.

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/MoodPanel.tsx src/components/panels/WaterPanel.tsx src/components/panels/PrioritiesPanel.tsx src/components/panels/HabitsPanel.tsx
git commit -m "Parameterize mood, water, priorities, and habits by date."
```

---

### Task 7: Date + readOnly for tasks, time, calendar, weather

**Files:**
- Modify: `src/components/panels/TasksPanel.tsx`
- Modify: `src/components/panels/TimeTrackingPanel.tsx`
- Modify: `src/components/panels/CalendarPanel.tsx`
- Modify: `src/components/panels/WeatherPanel.tsx`

**Interfaces:**
- Tasks `readOnly` + `date`: show tasks with `status = 'done'` and `updated_at` in `[startUtc, endUtc)` from `getDayRangeForDate` — **requires timezone**. Pass `timeZone` from grid/day shell OR compute range on server and pass `startUtc`/`endUtc`. Prefer adding optional `timeZone?: string` to dated panels (DayDashboard passes profile timezone; Today omits → keep existing browser-local behavior).

**Recommended common props for dated panels:**

```ts
type PanelBaseProps = {
  userId: string;
  date?: string;
  readOnly?: boolean;
  timeZone?: string;
};
```

- [ ] **Step 1: TasksPanel**
  - If `readOnly && date && timeZone`: query completed tasks in day range; no add/toggle/timer.
  - Else: existing live behavior.

- [ ] **Step 2: TimeTrackingPanel**
  - If `date && timeZone`: use `getDayRangeForDate(timeZone, date)` for entry bounds instead of `todayBoundsLocal()`.
  - If `readOnly`: hide start/stop/delete/form; still list entries for that day.
  - Query key includes `date`.

- [ ] **Step 3: CalendarPanel**
  - If `date && timeZone`: `timeMin`/`timeMax` from `getDayRangeForDate`.
  - Else: existing `startOfDay`/`endOfDay` local.
  - If `readOnly`, keep Settings empty-state links (OK) but no need for extra actions.
  - Update header label to the selected date.

- [ ] **Step 4: WeatherPanel**
  - Add optional `weatherSnapshot`.
  - If `readOnly && date` and snapshot present: render snapshot (temp + description + location).
  - If `readOnly && date` and no snapshot: “Weather unavailable for this day.”
  - If not read-only: existing live weather behavior.

- [ ] **Step 5: Thread `timeZone` through `DashboardGrid` → `renderPanel`**

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/TasksPanel.tsx src/components/panels/TimeTrackingPanel.tsx src/components/panels/CalendarPanel.tsx src/components/panels/WeatherPanel.tsx src/components/dashboard/DashboardGrid.tsx
git commit -m "Parameterize tasks, time, calendar, and weather for day view."
```

---

### Task 8: `DayDashboard` client shell

**Files:**
- Create: `src/components/blog/DayDashboard.tsx`

**Interfaces:**
- Consumes: `DayChrome`, `DayNotesList`, `DashboardGrid`, `MarkdownContent`, helpers
- Produces:

```ts
export function DayDashboard({
  userId,
  date,
  todayDate,
  timeZone,
  location,
  post, // null | { id, private_summary, is_public, generated_at, model, day_context }
  panels,
  notes,
}: { ... })
```

- [ ] **Step 1: Implement layout**

Order:

1. `<DayChrome … />`
2. Summary section: if `post`, show `private_summary` in markdown card; else muted “No digest yet for this day.”
3. `<DashboardGrid userId panels location readOnly date={date} timeZone={timeZone} weatherSnapshot={parseDayContextWeather(post?.day_context)} onLayoutChange={() => {}} onRemovePanel={() => {}} onUpdateConfig={() => {}} />`
4. Notes heading + `<DayNotesList notes={notes} />`

Use `max-w-6xl` to align with Today dashboard width (not the old narrow blog column).

- [ ] **Step 2: Commit**

```bash
git add src/components/blog/DayDashboard.tsx
git commit -m "Add DayDashboard shell for summary, grid, and notes."
```

---

### Task 9: Rewrite `/blog/[date]` server page

**Files:**
- Modify: `src/app/(app)/blog/[date]/page.tsx`

**Interfaces:**
- Consumes: `isValidPostDate`, `getDayRangeForDate`, `getDayRange`, `DayDashboard`

- [ ] **Step 1: Replace page logic**

```tsx
// pseudocode of required behavior
if (!isValidPostDate(date)) notFound();
user required
profile = timezone (default "UTC") + location
todayDate = getDayRange(timezone).postDate
range = getDayRangeForDate(timezone, date)

post = blog_posts maybeSingle for user+date  // OK if null

defaultDashboard = dashboards where is_default else first
panels = dashboard_panels for that dashboard ordered by y,x  // [] if none

notes = captures where user_id and created_at >= startUtc and < endUtc
  order created_at asc
  map visibility default private

return <DayDashboard ... />
```

Remove hard `notFound()` when post is missing. Remove `DaySignals` from primary UI. Remove `parseNotesSnapshot` dependency for primary notes list.

- [ ] **Step 2: Manual verify**
  - `/blog/2099-01-01` (valid date, empty) renders chrome + empty digest + empty notes
  - `/blog/not-a-date` → 404
  - Day with post still shows summary + publish

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/blog/[date]/page.tsx
git commit -m "Make blog day route a full day dashboard for any date."
```

---

### Task 10: Blog index entry points + copy

**Files:**
- Modify: `src/app/(app)/blog/page.tsx`

- [ ] **Step 1: Update copy** to describe day dashboards (digest when available, panels + notes for any day).

- [ ] **Step 2: Add “Open today (day view)”** link to `/blog/{todayDate}` using profile timezone (`getDayRange`). Keep post list as archive of digests.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/blog/page.tsx
git commit -m "Point blog index at browsable day dashboards."
```

---

### Task 11: Verification pass

- [ ] **Step 1: Unit tests**

Run: `npm run test:unit`  
Expected: PASS

- [ ] **Step 2: Lint/typecheck**

Run: `npm run lint` (and `npx tsc --noEmit` if used in repo)  
Expected: no new errors in touched files

- [ ] **Step 3: Manual checklist**
  - `/dashboard` still editable (drag, capture, toggles)
  - `/blog` lists posts; link opens day dashboard
  - Prev/next/date picker change days
  - Day without post: empty digest, notes if any, panels read-only
  - Day with post: summary + publish + snapshot weather if present
  - “Open live Today” only when viewing today’s date
  - `/p/[id]` unchanged

- [ ] **Step 4: Final commit only if verification fixes were needed**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Any day navigable | 1, 3, 9 |
| Optional LLM summary | 8, 9 |
| Current layout read-only grid | 5, 8, 9 |
| Date-parameterized panels | 6, 7 |
| Notes from live captures | 4, 9 |
| Prev/next + picker | 3 |
| Open live Today | 3 |
| Publish when post exists | 3, 9 |
| Weather from day_context | 2, 7, 8 |
| `/dashboard` unchanged role | 5, 11 |
| `/p/[id]` unchanged | 11 (verify) |
| Demote DaySignals | 9 |

## Self-review notes

- No snapshot/migration tasks (YAGNI per spec).
- Tasks panel historical definition is completed-in-range (aligned with digest collection); documented in Task 7.
- Timezone threaded explicitly for historical bounds so browser-local midnight does not diverge from digest days.
