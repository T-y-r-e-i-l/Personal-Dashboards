# Time Panel Pomodoro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable Pomodoro Focus / Short break / Long break countdowns to the Time panel while keeping the open-ended Start stopwatch, with auto-stop + toast (and optional notification) at zero.

**Architecture:** Persist durations on panel `config`. Persist active countdown on `time_entries` via `timer_mode` + `planned_seconds`. Pure helpers compute remaining time and defaults. `TimeTrackingPanel` renders mode buttons + countdown, auto-completes overdue sessions, and reuses existing start/stop entry helpers.

**Tech Stack:** Next.js App Router, Supabase, TanStack Query, existing `PanelConfigModal` / `DashboardGrid`, `node:test` via `npm run test:unit`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-time-panel-pomodoro-design.md`
- Defaults: Focus **25** / Short **5** / Long **15** minutes
- Actions: Focus · Short break · Long break **plus** Start stopwatch
- At zero: auto-stop, save entry, toast; browser notification if permission allows
- Breaks **do** create `time_entries`
- Clamp empty/≤0 settings to defaults on save
- Historical/read-only day view: no start controls
- Graceful fallback if migration columns missing (stopwatch-only; toast on Pomodoro start schema errors)

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260811060000_time_entries_pomodoro.sql` | Add `timer_mode`, `planned_seconds` |
| `src/lib/database.types.ts` | Type those columns on `time_entries` |
| `src/lib/panels/types.ts` | `PanelConfig` pomodoro minute fields |
| `src/lib/time/pomodoro.ts` | Defaults, clamp, remaining helpers, mode labels |
| `src/lib/time/pomodoro.test.ts` | Unit tests for helpers |
| `src/lib/time/entries.ts` | Extend `startTimer` with mode + planned seconds |
| `src/lib/time/entries.test.ts` | Keep existing; add pure helper coverage only if exported from entries (prefer pomodoro.test) |
| `src/components/dashboard/PanelConfigModal.tsx` | Time settings inputs |
| `src/components/dashboard/DashboardGrid.tsx` | Pass `config` into `TimeTrackingPanel` |
| `src/components/panels/TimeTrackingPanel.tsx` | Mode buttons, countdown UI, auto-stop, notifications |

---

### Task 1: Migration + types + PanelConfig fields

**Files:**
- Create: `supabase/migrations/20260811060000_time_entries_pomodoro.sql`
- Modify: `src/lib/database.types.ts` (`time_entries` Row/Insert)
- Modify: `src/lib/panels/types.ts` (`PanelConfig`)

**Interfaces:**
- Produces DB columns:
  - `timer_mode text not null default 'stopwatch'` with check in `('stopwatch','focus','short_break','long_break')`
  - `planned_seconds integer null` with check `planned_seconds is null or planned_seconds > 0`
- Produces types:
  - `TimerMode = "stopwatch" | "focus" | "short_break" | "long_break"` (can live in `pomodoro.ts` Task 2; DB row uses `string` or the union on Row)
  - `PanelConfig.pomodoroFocusMin?: number`
  - `PanelConfig.pomodoroShortBreakMin?: number`
  - `PanelConfig.pomodoroLongBreakMin?: number`

- [ ] **Step 1: Add migration**

```sql
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
```

- [ ] **Step 2: Update `database.types.ts` `time_entries` Row + Insert**

Add to Row:

```ts
timer_mode: "stopwatch" | "focus" | "short_break" | "long_break";
planned_seconds: number | null;
```

Add to Insert (optional):

```ts
timer_mode?: "stopwatch" | "focus" | "short_break" | "long_break";
planned_seconds?: number | null;
```

- [ ] **Step 3: Extend `PanelConfig` in `src/lib/panels/types.ts`**

```ts
export type PanelConfig = {
  dateRange?: "7d" | "30d" | "90d" | "6m" | "1y";
  showCompleted?: boolean;
  location?: string;
  /** Time panel Pomodoro lengths (minutes). */
  pomodoroFocusMin?: number;
  pomodoroShortBreakMin?: number;
  pomodoroLongBreakMin?: number;
};
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811060000_time_entries_pomodoro.sql \
  src/lib/database.types.ts src/lib/panels/types.ts
git commit -m "$(cat <<'EOF'
Add Pomodoro columns and Time panel config fields.

EOF
)"
```

---

### Task 2: Pure Pomodoro helpers (TDD)

**Files:**
- Create: `src/lib/time/pomodoro.ts`
- Create: `src/lib/time/pomodoro.test.ts`

**Interfaces:**
- Produces:
  - `export type TimerMode = "stopwatch" | "focus" | "short_break" | "long_break"`
  - `export const POMODORO_DEFAULTS = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15 } as const`
  - `export function clampPomodoroMinutes(value: unknown, fallback: number): number` — finite number, `Math.floor`, if `<= 0` or non-finite → `fallback`
  - `export function resolvePomodoroConfig(config?: { pomodoroFocusMin?: number; pomodoroShortBreakMin?: number; pomodoroLongBreakMin?: number }): { focusMin: number; shortBreakMin: number; longBreakMin: number }`
  - `export function plannedSecondsForMode(mode: Exclude<TimerMode, "stopwatch">, mins: ReturnType<typeof resolvePomodoroConfig>): number`
  - `export function remainingMs(startedAt: string, plannedSeconds: number, now?: number): number` — `max(0, plannedSeconds*1000 - elapsed)`
  - `export function isPomodoroComplete(startedAt: string, plannedSeconds: number, now?: number): boolean`
  - `export function modeLabel(mode: TimerMode): string` — `"Focus" | "Short break" | "Long break" | "Timer"`
  - `export function completeToastMessage(mode: TimerMode): string` — `"Focus complete"` / `"Break complete"` / `"Timer stopped"` (stopwatch unused for auto-complete)

- [ ] **Step 1: Write failing tests in `src/lib/time/pomodoro.test.ts`**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampPomodoroMinutes,
  completeToastMessage,
  isPomodoroComplete,
  modeLabel,
  plannedSecondsForMode,
  remainingMs,
  resolvePomodoroConfig,
} from "@/lib/time/pomodoro";

describe("clampPomodoroMinutes", () => {
  it("floors positive values and falls back for invalid", () => {
    assert.equal(clampPomodoroMinutes(25.9, 25), 25);
    assert.equal(clampPomodoroMinutes(0, 25), 25);
    assert.equal(clampPomodoroMinutes(-1, 5), 5);
    assert.equal(clampPomodoroMinutes("x", 15), 15);
    assert.equal(clampPomodoroMinutes(undefined, 25), 25);
  });
});

describe("resolvePomodoroConfig", () => {
  it("applies defaults and clamps", () => {
    assert.deepEqual(resolvePomodoroConfig(undefined), {
      focusMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
    });
    assert.deepEqual(
      resolvePomodoroConfig({
        pomodoroFocusMin: 30,
        pomodoroShortBreakMin: 0,
        pomodoroLongBreakMin: 20,
      }),
      { focusMin: 30, shortBreakMin: 5, longBreakMin: 20 },
    );
  });
});

describe("plannedSecondsForMode", () => {
  it("converts minutes to seconds", () => {
    const mins = resolvePomodoroConfig({ pomodoroFocusMin: 25 });
    assert.equal(plannedSecondsForMode("focus", mins), 25 * 60);
    assert.equal(plannedSecondsForMode("short_break", mins), 5 * 60);
    assert.equal(plannedSecondsForMode("long_break", mins), 15 * 60);
  });
});

describe("remainingMs / isPomodoroComplete", () => {
  it("counts down and completes at/after planned end", () => {
    const start = "2026-08-11T12:00:00.000Z";
    const planned = 25 * 60;
    const t0 = Date.parse(start);
    assert.equal(remainingMs(start, planned, t0), 25 * 60_000);
    assert.equal(remainingMs(start, planned, t0 + 60_000), 24 * 60_000);
    assert.equal(remainingMs(start, planned, t0 + 25 * 60_000), 0);
    assert.equal(isPomodoroComplete(start, planned, t0 + 25 * 60_000 - 1), false);
    assert.equal(isPomodoroComplete(start, planned, t0 + 25 * 60_000), true);
  });
});

describe("labels", () => {
  it("returns UI and toast copy", () => {
    assert.equal(modeLabel("focus"), "Focus");
    assert.equal(modeLabel("short_break"), "Short break");
    assert.equal(modeLabel("long_break"), "Long break");
    assert.equal(modeLabel("stopwatch"), "Timer");
    assert.equal(completeToastMessage("focus"), "Focus complete");
    assert.equal(completeToastMessage("short_break"), "Break complete");
    assert.equal(completeToastMessage("long_break"), "Break complete");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test:unit -- --test-name-pattern "clampPomodoroMinutes|resolvePomodoroConfig|plannedSecondsForMode|remainingMs|labels"`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `src/lib/time/pomodoro.ts`**

Implement the exports listed in **Interfaces** so all tests pass. Use `elapsedMs` from `@/lib/time/entries` inside `remainingMs` / `isPomodoroComplete`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm run test:unit -- src/lib/time/pomodoro.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/time/pomodoro.ts src/lib/time/pomodoro.test.ts
git commit -m "$(cat <<'EOF'
Add Pomodoro duration and countdown helpers.

EOF
)"
```

---

### Task 3: Extend `startTimer` for modes

**Files:**
- Modify: `src/lib/time/entries.ts` (`startTimer`)

**Interfaces:**
- Consumes: `TimerMode` from `@/lib/time/pomodoro`
- Produces updated:
  - `startTimer(supabase, { userId, taskId?, description?, timerMode?: TimerMode, plannedSeconds?: number | null }): Promise<TimeEntryRow>`
  - Defaults: `timerMode = "stopwatch"`, `plannedSeconds = null`
  - Insert (and retry insert) must include `timer_mode` and `planned_seconds`

- [ ] **Step 1: Update `startTimer` signature and inserts**

In both insert paths in `startTimer`:

```ts
timer_mode: timerMode ?? "stopwatch",
planned_seconds:
  timerMode && timerMode !== "stopwatch"
    ? (plannedSeconds ?? null)
    : null,
```

Accept params:

```ts
{
  userId: string;
  taskId?: string | null;
  description?: string;
  timerMode?: TimerMode;
  plannedSeconds?: number | null;
}
```

- [ ] **Step 2: Manual sanity check (no DB in unit tests)**

Confirm TypeScript compiles for the changed file:

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`
Expected: no errors from `entries.ts` / pomodoro imports (project may have unrelated errors — fix only what this task introduced)

- [ ] **Step 3: Commit**

```bash
git add src/lib/time/entries.ts
git commit -m "$(cat <<'EOF'
Pass Pomodoro mode and planned length into startTimer.

EOF
)"
```

---

### Task 4: Time settings in `PanelConfigModal`

**Files:**
- Modify: `src/components/dashboard/PanelConfigModal.tsx`

**Interfaces:**
- Consumes: `resolvePomodoroConfig`, `clampPomodoroMinutes`, `POMODORO_DEFAULTS` from `@/lib/time/pomodoro`
- On Save for `panelType === "time"`: write clamped minutes into `config` before `onSave`

- [ ] **Step 1: Initialize local config minutes from `initial`**

When rendering time settings, derive display values with `resolvePomodoroConfig(config)`.

- [ ] **Step 2: Add `panelType === "time"` settings block**

Place before the generic “No extra settings” branch (update the exclusion list to include `"time"`):

```tsx
{panelType === "time" && (
  <div className="space-y-3">
    <span className="block text-sm font-medium">Pomodoro lengths</span>
    {(
      [
        ["pomodoroFocusMin", "Focus (minutes)", "focusMin"],
        ["pomodoroShortBreakMin", "Short break (minutes)", "shortBreakMin"],
        ["pomodoroLongBreakMin", "Long break (minutes)", "longBreakMin"],
      ] as const
    ).map(([key, label]) => (
      <label key={key} className="block text-sm">
        <span className="mb-1.5 block font-medium">{label}</span>
        <input
          type="number"
          min={1}
          step={1}
          value={config[key] ?? resolvePomodoroConfig(config)[
            key === "pomodoroFocusMin"
              ? "focusMin"
              : key === "pomodoroShortBreakMin"
                ? "shortBreakMin"
                : "longBreakMin"
          ]}
          onChange={(e) =>
            setConfig((c) => ({
              ...c,
              [key]: e.target.value === "" ? undefined : Number(e.target.value),
            }))
          }
          className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
        />
      </label>
    ))}
  </div>
)}
```

(Prefer a cleaner explicit three-label form if the map feels noisy — either is fine.)

- [ ] **Step 3: Clamp on Save for time panels**

In the Save handler, before `onSave(config)`:

```ts
const next =
  panelType === "time"
    ? (() => {
        const resolved = resolvePomodoroConfig(config);
        return {
          ...config,
          pomodoroFocusMin: resolved.focusMin,
          pomodoroShortBreakMin: resolved.shortBreakMin,
          pomodoroLongBreakMin: resolved.longBreakMin,
        };
      })()
    : config;
onSave(next);
```

- [ ] **Step 4: Update empty-settings exclusion**

Change:

```ts
!["habits", "mood", "tasks", "weather"].includes(panelType)
```

to include `"time"`.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/PanelConfigModal.tsx
git commit -m "$(cat <<'EOF'
Add Pomodoro minute settings to the Time panel modal.

EOF
)"
```

---

### Task 5: Wire config into `TimeTrackingPanel` + Pomodoro UI/behavior

**Files:**
- Modify: `src/components/dashboard/DashboardGrid.tsx` (pass `config` for `time`)
- Modify: `src/components/panels/TimeTrackingPanel.tsx`

**Interfaces:**
- Consumes: `config?: PanelConfig` on `TimeTrackingPanel`
- Consumes: `resolvePomodoroConfig`, `plannedSecondsForMode`, `remainingMs`, `isPomodoroComplete`, `modeLabel`, `completeToastMessage`, `TimerMode`
- Consumes: updated `startTimer`

**Behavior to implement:**

1. **Idle / active chrome:** Above Start form, render three buttons when `interactive`:
   - Focus → `startPomodoro("focus")`
   - Short break → `startPomodoro("short_break")`
   - Long break → `startPomodoro("long_break")`
   - Show minutes from `resolvePomodoroConfig(config)` under/ beside each (e.g. `25m`)

2. **`startPomodoro(mode)`:**
   - Breaks: `description` = `modeLabel(mode)`, `taskId` null, `plannedSeconds` from settings
   - Focus: use trimmed `description` or selected task title or `"Focus"`; keep optional `taskId` from form; set planned seconds for focus

3. **Existing Start form:** call `startTimer` with `timerMode: "stopwatch"` (explicit)

4. **Running display:**
   - Title: task title / description / `modeLabel`
   - If `active.planned_seconds`: show `formatDuration(remainingMs(...))` countdown
   - Else: existing count-up via `elapsedMs`

5. **Auto-complete effect:** when `interactive && active?.planned_seconds && isPomodoroComplete(...)`, call `stop.mutate()` once (guard with a ref of completed entry id to avoid double-fire). On success toast `completeToastMessage(active.timer_mode)`. Also:

```ts
if (typeof Notification !== "undefined" && Notification.permission === "granted") {
  new Notification(completeToastMessage(mode), { body: active.description || modeLabel(mode) });
} else if (typeof Notification !== "undefined" && Notification.permission === "default") {
  void Notification.requestPermission();
}
```

Request permission preferably once on first Pomodoro start (optional) or on first completion attempt — either acceptable; prefer request on first Focus/break start so completion can notify.

6. **Schema errors:** if start fails with column/schema cache message, toast: `Run the time_entries Pomodoro migration in Supabase.`

7. **Read-only:** hide mode buttons and Start form (already gated by `interactive`)

- [ ] **Step 1: Pass config in `DashboardGrid`**

```tsx
case "time":
  return <TimeTrackingPanel {...common} config={config} />;
```

- [ ] **Step 2: Add `config?: PanelConfig` prop and resolve minutes**

```tsx
import type { PanelConfig } from "@/lib/panels/types";
import {
  completeToastMessage,
  isPomodoroComplete,
  modeLabel,
  plannedSecondsForMode,
  remainingMs,
  resolvePomodoroConfig,
  type TimerMode,
} from "@/lib/time/pomodoro";

// in component:
const pomodoro = resolvePomodoroConfig(config);
```

- [ ] **Step 3: Add mode button row + startPomodoro mutation path**

Implement UI roughly:

```tsx
{interactive ? (
  <div className="grid grid-cols-3 gap-2">
    {(
      [
        ["focus", "Focus", pomodoro.focusMin],
        ["short_break", "Short break", pomodoro.shortBreakMin],
        ["long_break", "Long break", pomodoro.longBreakMin],
      ] as const
    ).map(([mode, label, minutes]) => (
      <button
        key={mode}
        type="button"
        disabled={start.isPending || stop.isPending}
        onClick={() => startPomodoro(mode)}
        className="rounded-xl border border-[var(--border)] px-2 py-2 text-center transition hover:bg-[var(--surface-soft)]"
      >
        <span className="block text-xs font-medium text-[var(--ink)]">{label}</span>
        <span className="block text-[11px] text-[var(--muted)]">{minutes}m</span>
      </button>
    ))}
  </div>
) : null}
```

Wire `startPomodoro` through the existing `start` mutation (extend mutationFn to accept optional mode args) or a dedicated mutation that calls `startTimer` with mode fields.

- [ ] **Step 4: Countdown display + auto-complete effect**

```tsx
useEffect(() => {
  if (!interactive || !active?.planned_seconds || !active.started_at) return;
  if (!isPomodoroComplete(active.started_at, active.planned_seconds, now)) return;
  if (autoCompletedId.current === active.id) return;
  autoCompletedId.current = active.id;
  stop.mutate(undefined, {
    onSuccess: () => {
      const mode = (active.timer_mode ?? "focus") as TimerMode;
      showToast(completeToastMessage(mode));
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(completeToastMessage(mode), {
          body: active.description || modeLabel(mode),
        });
      }
    },
  });
}, [active, interactive, now, showToast, stop]);
```

Keep a 1s interval whenever a Pomodoro **or** stopwatch is running (existing effect already keys off `running.data`).

- [ ] **Step 5: Manual UI check**

Run: `npm run test:unit -- src/lib/time/pomodoro.test.ts`
Expected: PASS

In the browser (after applying migration): open Time settings → set times → Save → start Focus → confirm countdown → wait or temporarily set 1 min → auto-stop + toast; start Short/Long break → entries appear; Start stopwatch still counts up.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/DashboardGrid.tsx \
  src/components/panels/TimeTrackingPanel.tsx
git commit -m "$(cat <<'EOF'
Add Pomodoro controls and countdown to the Time panel.

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Panel config minutes + defaults 25/5/15 | 1, 2, 4 |
| `timer_mode` / `planned_seconds` migration | 1, 3 |
| Focus · Short · Long + Start stopwatch | 5 |
| Countdown vs count-up | 5 |
| Auto-stop + toast + optional notification | 5 |
| Breaks logged as entries | 3, 5 |
| Refresh rebuilds remaining / overdue auto-stop | 5 |
| Clamp on save | 2, 4 |
| Read-only unchanged | 5 |
| Schema migration fallback toast | 5 |

## Out of scope (do not implement)

- Auto-chain focus→break
- Cycle counter / every-N long break
- Custom sounds beyond Notification API
- Editing historical `timer_mode`
