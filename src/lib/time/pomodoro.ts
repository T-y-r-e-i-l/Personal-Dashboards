import { elapsedMs } from "@/lib/time/entries";

export type TimerMode = "stopwatch" | "focus" | "short_break" | "long_break";

export const POMODORO_DEFAULTS = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
} as const;

export function clampPomodoroMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function resolvePomodoroConfig(config?: {
  pomodoroFocusMin?: number;
  pomodoroShortBreakMin?: number;
  pomodoroLongBreakMin?: number;
}): { focusMin: number; shortBreakMin: number; longBreakMin: number } {
  return {
    focusMin: clampPomodoroMinutes(
      config?.pomodoroFocusMin,
      POMODORO_DEFAULTS.focusMin,
    ),
    shortBreakMin: clampPomodoroMinutes(
      config?.pomodoroShortBreakMin,
      POMODORO_DEFAULTS.shortBreakMin,
    ),
    longBreakMin: clampPomodoroMinutes(
      config?.pomodoroLongBreakMin,
      POMODORO_DEFAULTS.longBreakMin,
    ),
  };
}

export function plannedSecondsForMode(
  mode: Exclude<TimerMode, "stopwatch">,
  mins: ReturnType<typeof resolvePomodoroConfig>,
): number {
  switch (mode) {
    case "focus":
      return mins.focusMin * 60;
    case "short_break":
      return mins.shortBreakMin * 60;
    case "long_break":
      return mins.longBreakMin * 60;
  }
}

export function remainingMs(
  startedAt: string,
  plannedSeconds: number,
  now?: number,
): number {
  const elapsed = elapsedMs(startedAt, null, now);
  return Math.max(0, plannedSeconds * 1000 - elapsed);
}

export function isPomodoroComplete(
  startedAt: string,
  plannedSeconds: number,
  now?: number,
): boolean {
  return remainingMs(startedAt, plannedSeconds, now) === 0;
}

export function modeLabel(mode: TimerMode): string {
  switch (mode) {
    case "focus":
      return "Focus";
    case "short_break":
      return "Short break";
    case "long_break":
      return "Long break";
    case "stopwatch":
      return "Timer";
  }
}

export function completeToastMessage(mode: TimerMode): string {
  switch (mode) {
    case "focus":
      return "Focus complete";
    case "short_break":
    case "long_break":
      return "Break complete";
    case "stopwatch":
      return "Timer stopped";
  }
}
