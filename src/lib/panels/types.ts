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
    defaultW: 4,
    defaultH: 3,
    description: "Daily habits and streaks",
  },
  mood: {
    label: "Mood",
    defaultW: 3,
    defaultH: 3,
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
    description: "Today's events",
  },
  time: {
    label: "Time",
    defaultW: 4,
    defaultH: 3,
    description: "Track focus time, optionally linked to to-dos",
  },
};

export type PanelConfig = {
  dateRange?: "7d" | "30d" | "90d";
  showCompleted?: boolean;
  location?: string;
};
