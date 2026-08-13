export const SOUND_SLOTS = [
  "generic_click",
  "todo_complete",
  "timer_start",
  "timer_end",
  "panel_swap",
  "capture_note",
  "habit_complete",
  "habit_uncomplete",
  "document_edit",
  "nav_click",
  "button_click",
  "panel_open",
  "panel_close",
  "error",
] as const;

export type SoundSlot = (typeof SOUND_SLOTS)[number];

export type SoundSlotMeta = {
  id: SoundSlot;
  label: string;
  description: string;
};

export const SOUND_SLOT_CATALOG: SoundSlotMeta[] = [
  {
    id: "generic_click",
    label: "Generic click",
    description:
      "Replaces the built-in click for every slot that has no custom upload.",
  },
  {
    id: "todo_complete",
    label: "To-do complete",
    description: "Marking a task as done.",
  },
  {
    id: "timer_start",
    label: "Timer start",
    description: "Starting a focus, stopwatch, or Pomodoro timer.",
  },
  {
    id: "timer_end",
    label: "Timer end",
    description: "Stopping or finishing a timer.",
  },
  {
    id: "panel_swap",
    label: "Swap panels",
    description: "Changing a panel’s type in panel settings.",
  },
  {
    id: "capture_note",
    label: "Capture note",
    description: "Successfully saving a Quick Capture note.",
  },
  {
    id: "habit_complete",
    label: "Habit complete",
    description: "Checking a habit as done for the day.",
  },
  {
    id: "habit_uncomplete",
    label: "Habit unmark",
    description: "Unchecking a habit.",
  },
  {
    id: "document_edit",
    label: "Editing a document",
    description: "Typing in a note or capture composer (debounced).",
  },
  {
    id: "nav_click",
    label: "Navigation",
    description: "Main nav, menubar, or Finder icon clicks.",
  },
  {
    id: "button_click",
    label: "Button click",
    description: "Primary and secondary buttons without a more specific sound.",
  },
  {
    id: "panel_open",
    label: "Panel open",
    description: "Opening panel settings or major dialogs.",
  },
  {
    id: "panel_close",
    label: "Panel close",
    description: "Closing dialogs or the mobile Finder.",
  },
  {
    id: "error",
    label: "Error",
    description: "Failed actions and error toasts.",
  },
];

export function isSoundSlot(value: string): value is SoundSlot {
  return (SOUND_SLOTS as readonly string[]).includes(value);
}

export const DEFAULT_CLICK_SRC = "/sounds/default-click.wav";
