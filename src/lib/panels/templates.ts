import type { PanelType } from "@/lib/panels/types";

export type TemplateId =
  | "morning"
  | "work"
  | "weekly"
  | "blank";

export type TemplatePanel = {
  panel_type: PanelType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
};

export type DashboardTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  panels: TemplatePanel[];
};

export const TEMPLATES: DashboardTemplate[] = [
  {
    id: "morning",
    name: "Morning Routine",
    description: "Priorities, weather, water, habits, and mood to start the day.",
    panels: [
      { panel_type: "priorities", x: 0, y: 0, w: 4, h: 3 },
      { panel_type: "weather", x: 4, y: 0, w: 2, h: 2 },
      { panel_type: "water", x: 6, y: 0, w: 2, h: 2 },
      { panel_type: "habits", x: 4, y: 2, w: 4, h: 3 },
      { panel_type: "mood", x: 0, y: 3, w: 4, h: 2 },
    ],
  },
  {
    id: "work",
    name: "Work Day",
    description: "Tasks, time tracking, calendar, and priorities for focused work.",
    panels: [
      { panel_type: "tasks", x: 0, y: 0, w: 4, h: 3 },
      { panel_type: "time", x: 4, y: 0, w: 4, h: 3 },
      { panel_type: "calendar", x: 0, y: 3, w: 4, h: 3 },
      { panel_type: "priorities", x: 4, y: 3, w: 4, h: 3 },
    ],
  },
  {
    id: "weekly",
    name: "Weekly Review",
    description: "Habits, mood, and calendar for reflection.",
    panels: [
      { panel_type: "habits", x: 0, y: 0, w: 4, h: 3 },
      { panel_type: "mood", x: 4, y: 0, w: 4, h: 3 },
      { panel_type: "reflection", x: 0, y: 3, w: 4, h: 3 },
      { panel_type: "calendar", x: 4, y: 3, w: 4, h: 3 },
    ],
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start empty and add the panels you need.",
    panels: [],
  },
];

export function getTemplate(id: TemplateId) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[3];
}
