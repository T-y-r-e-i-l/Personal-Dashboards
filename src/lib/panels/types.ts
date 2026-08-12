import type { PanelType } from "@/lib/database.types";

export type { PanelType };

export const PANEL_META: Record<
  PanelType,
  { label: string; defaultW: number; defaultH: number; description: string }
> = {
  tasks: {
    label: "To-Do",
    defaultW: 3,
    defaultH: 3,
    description: "Today's tasks and upcoming deadlines",
  },
  habits: {
    label: "Habits",
    defaultW: 6,
    defaultH: 4,
    description: "Daily habits and streaks",
  },
  mood: {
    label: "Mood",
    defaultW: 4,
    defaultH: 4,
    description: "Mood and energy trends",
  },
  priorities: {
    label: "Priorities",
    defaultW: 3,
    defaultH: 3,
    description: "Must / should / nice for today",
  },
  water: {
    label: "Water",
    defaultW: 2,
    defaultH: 2,
    description: "Daily hydration goal",
  },
  weather: {
    label: "Weather",
    defaultW: 2,
    defaultH: 2,
    description: "Local conditions",
  },
  calendar: {
    label: "Calendar",
    defaultW: 3,
    defaultH: 3,
    description: "Today's Google Calendar events",
  },
  time: {
    label: "Time",
    defaultW: 4,
    defaultH: 3,
    description: "Track focus time, optionally linked to to-dos",
  },
  sleep: {
    label: "Sleep",
    defaultW: 3,
    defaultH: 3,
    description: "Last night's sleep start, end, duration, score, and rating",
  },
  reflection: {
    label: "Reflection",
    defaultW: 3,
    defaultH: 3,
    description: "A daily prompt for journaling and self-reflection",
  },
  timelapse: {
    label: "Timelapse",
    defaultW: 3,
    defaultH: 3,
    description: "Play daily selfies oldest to newest",
  },
};

export type PanelConfig = {
  /** Mood: 7d/30d/90d. Habits: 7d/30d/6m/1y (90d treated as 6m). */
  dateRange?: "7d" | "30d" | "90d" | "6m" | "1y";
  showCompleted?: boolean;
  location?: string;
  /** Time panel Pomodoro lengths (minutes). */
  pomodoroFocusMin?: number;
  pomodoroShortBreakMin?: number;
  pomodoroLongBreakMin?: number;
  /** Timelapse: selfie lookback range. */
  selfieRange?: "30d" | "90d" | "all";
  /** Timelapse playback speed (frames per second). */
  timelapseFps?: number;
};
