import type { DayContext } from "@/lib/blog/types";

export type DigestActivityKey =
  | "completed_tasks"
  | "priorities"
  | "mood"
  | "calendar"
  | "habits"
  | "water"
  | "time_tracking"
  | "weather";

export type DigestActivities = Record<DigestActivityKey, boolean>;

export type DigestSelection = {
  noteIds: string[];
  activities: DigestActivities;
};

export const DIGEST_ACTIVITY_KEYS: DigestActivityKey[] = [
  "completed_tasks",
  "priorities",
  "mood",
  "calendar",
  "habits",
  "water",
  "time_tracking",
  "weather",
];

export const DIGEST_ACTIVITY_LABELS: Record<DigestActivityKey, string> = {
  completed_tasks: "Completed tasks",
  priorities: "Priorities",
  mood: "Mood",
  calendar: "Calendar",
  habits: "Habits",
  water: "Water",
  time_tracking: "Time tracking",
  weather: "Weather",
};

export function emptyDigestActivities(
  value = false,
): DigestActivities {
  return {
    completed_tasks: value,
    priorities: value,
    mood: value,
    calendar: value,
    habits: value,
    water: value,
    time_tracking: value,
    weather: value,
  };
}

export function parseDigestSelection(value: unknown): DigestSelection | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.noteIds)) return null;
  if (!row.activities || typeof row.activities !== "object") return null;

  const noteIds = row.noteIds.filter(
    (id): id is string => typeof id === "string",
  );
  const activities = emptyDigestActivities(false);
  const raw = row.activities as Record<string, unknown>;
  for (const key of DIGEST_ACTIVITY_KEYS) {
    activities[key] = Boolean(raw[key]);
  }

  return { noteIds, activities };
}

export function dayContextHasSignal(context: DayContext): boolean {
  return (
    context.notes.length > 0 ||
    context.completed_tasks.length > 0 ||
    context.priorities.length > 0 ||
    context.mood !== null ||
    context.calendar.length > 0 ||
    context.habits.some((h) => h.completed) ||
    (context.water !== null && context.water.glasses > 0) ||
    context.time_tracking.length > 0 ||
    context.weather !== null
  );
}

export function selectionHasSignal(selection: DigestSelection): boolean {
  if (selection.noteIds.length > 0) return true;
  return DIGEST_ACTIVITY_KEYS.some((key) => selection.activities[key]);
}

export function filterDayContext(
  context: DayContext,
  selection: DigestSelection,
): DayContext {
  const noteIdSet = new Set(selection.noteIds);
  const a = selection.activities;

  return {
    ...context,
    notes: context.notes.filter((note) => noteIdSet.has(note.id)),
    completed_tasks: a.completed_tasks ? context.completed_tasks : [],
    priorities: a.priorities ? context.priorities : [],
    mood: a.mood ? context.mood : null,
    calendar: a.calendar ? context.calendar : [],
    habits: a.habits ? context.habits : [],
    water: a.water ? context.water : null,
    time_tracking: a.time_tracking ? context.time_tracking : [],
    weather: a.weather ? context.weather : null,
  };
}

export type DigestSourcesInventory = {
  postDate: string;
  notes: {
    id: string;
    created_at: string;
    visibility: "private" | "public";
    preview: string;
  }[];
  activities: {
    key: DigestActivityKey;
    label: string;
    available: boolean;
    count?: number;
  }[];
};

function notePreview(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= 100) return flat;
  return `${flat.slice(0, 100)}…`;
}

export function inventoryFromDayContext(
  context: DayContext,
): DigestSourcesInventory {
  const completedHabits = context.habits.filter((h) => h.completed).length;

  return {
    postDate: context.post_date,
    notes: context.notes.map((note) => ({
      id: note.id,
      created_at: note.created_at,
      visibility: note.visibility,
      preview: notePreview(note.content) || "(empty note)",
    })),
    activities: [
      {
        key: "completed_tasks",
        label: DIGEST_ACTIVITY_LABELS.completed_tasks,
        available: context.completed_tasks.length > 0,
        count: context.completed_tasks.length,
      },
      {
        key: "priorities",
        label: DIGEST_ACTIVITY_LABELS.priorities,
        available: context.priorities.length > 0,
        count: context.priorities.length,
      },
      {
        key: "mood",
        label: DIGEST_ACTIVITY_LABELS.mood,
        available: context.mood !== null,
      },
      {
        key: "calendar",
        label: DIGEST_ACTIVITY_LABELS.calendar,
        available: context.calendar.length > 0,
        count: context.calendar.length,
      },
      {
        key: "habits",
        label: DIGEST_ACTIVITY_LABELS.habits,
        available: completedHabits > 0,
        count: completedHabits,
      },
      {
        key: "water",
        label: DIGEST_ACTIVITY_LABELS.water,
        available: context.water !== null && context.water.glasses > 0,
        count: context.water?.glasses,
      },
      {
        key: "time_tracking",
        label: DIGEST_ACTIVITY_LABELS.time_tracking,
        available: context.time_tracking.length > 0,
        count: context.time_tracking.length,
      },
      {
        key: "weather",
        label: DIGEST_ACTIVITY_LABELS.weather,
        available: context.weather !== null,
      },
    ],
  };
}

export function defaultSelectionFromInventory(
  inventory: DigestSourcesInventory,
): DigestSelection {
  const activities = emptyDigestActivities(false);
  for (const activity of inventory.activities) {
    activities[activity.key] = activity.available;
  }
  return {
    noteIds: inventory.notes.map((note) => note.id),
    activities,
  };
}
