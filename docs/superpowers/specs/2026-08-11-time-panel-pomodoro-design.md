# Time panel Pomodoro design

**Date:** 2026-08-11  
**Status:** Approved for implementation  
**Scope:** Add Pomodoro modes + settings to the Time panel; keep open-ended Start stopwatch

## Goal

The Time panel should support classic Pomodoro sessions (focus, short break, long break) with configurable durations, while retaining a bespoke open-ended **Start** stopwatch. Countdown sessions auto-complete when time runs out and still write normal `time_entries` rows.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Panel actions | **A** — Focus · Short break · Long break buttons **plus** separate Start stopwatch |
| Settings location | **A** — Time panel settings modal; editable minutes; defaults 25 / 5 / 15 |
| On countdown zero | **A** — Auto-stop, save entry, toast; optional browser notification if permitted |
| Break logging | **A** — Short/long breaks create `time_entries` like focus sessions |
| Architecture | **1** — Panel config + `timer_mode` / `planned_seconds` on `time_entries` |

## Data model

### Panel config (`PanelConfig`)

Add optional fields used when `panel_type === "time"`:

- `pomodoroFocusMin?: number` — default **25**
- `pomodoroShortBreakMin?: number` — default **5**
- `pomodoroLongBreakMin?: number` — default **15**

Persisted with existing dashboard panel config (same Save path as other panels). On save, clamp empty/≤0 values to defaults.

### `time_entries` migration

Add nullable columns (stopwatch unchanged):

| Column | Type | Notes |
| --- | --- | --- |
| `timer_mode` | text / enum-like | `'stopwatch' \| 'focus' \| 'short_break' \| 'long_break'`; default `'stopwatch'` |
| `planned_seconds` | integer, nullable | null for stopwatch; settings minutes × 60 for Pomodoro modes |

Update generated/`database.types` accordingly.

### Entry labels

| Mode | Description | Task link |
| --- | --- | --- |
| Focus | Optional note/task title, else `"Focus"` | Optional (same pattern as Start) |
| Short break | `"Short break"` | None |
| Long break | `"Long break"` | None |
| Start (stopwatch) | Existing behavior | Optional |

## UI

### Idle (no running timer)

1. Row of three actions: **Focus** · **Short break** · **Long break**  
   - Show configured minutes in subtitle/tooltip (e.g. “25m”).
2. Existing **Start** form below: description + optional to-do + **Start** (stopwatch).
3. Finished entries list unchanged; Pomodoro/break rows appear like other sessions.

### Running

- Mode label: Focus / Short break / Long break / Timer.
- **Countdown** when `planned_seconds` is set; **count-up** for stopwatch.
- **Stop** for manual end.
- Linked to-do note only for Focus/Start when applicable.
- Starting another mode or Start stops the current entry first (existing `startTimer` behavior).

### Settings modal (`PanelConfigModal` for `time`)

- Three minute number inputs: Focus / Short break / Long break.
- Swap / Cancel / Save unchanged.

## Behavior

### Start paths

- **Focus / Short / Long:** stop any running entry; insert with `timer_mode` + `planned_seconds` from panel config.
- **Start:** stopwatch — `timer_mode: 'stopwatch'`, `planned_seconds: null` (today’s flow).

### While running (Pomodoro)

- Tick every 1s; remaining = `max(0, planned_seconds − elapsed)`.
- When `elapsed ≥ planned_seconds`: auto-stop (`ended_at`), toast (“Focus complete” / “Break complete”), request/show browser notification if permission allows.
- Manual Stop saves actual elapsed (partial sessions OK).

### Edge cases

- Refresh / other tab: rebuild countdown from `started_at` + `planned_seconds`.
- Already past end on load: auto-stop once.
- Historical / read-only day view: no start controls (unchanged).
- Missing migration columns: graceful fallback — treat as stopwatch-only until migration applied (toast if Pomodoro start fails on schema).

## Out of scope

- Auto-chain (focus → break → focus) without user tap
- Pomodoro cycle counter / “every N focus → long break” automation
- Sounds beyond optional browser notification
- Editing past entries’ `timer_mode`
- Mobile-specific redesign beyond fitting the existing panel chrome

## Acceptance criteria

1. Time settings can set focus / short / long minutes; Save persists them.
2. Idle panel shows Focus, Short break, Long break, and Start stopwatch.
3. Pomodoro modes countdown; stopwatch counts up.
4. At 0:00, entry auto-stops and user gets a toast (notification if permitted).
5. Breaks and focus sessions appear in today’s finished list.
6. Refresh mid-session preserves correct remaining time (or auto-completes if overdue).
