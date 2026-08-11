export type NoteVisibility = "private" | "public";

export type NoteSnapshot = {
  id: string;
  content: string;
  visibility: NoteVisibility;
  created_at: string;
};

export type DayContext = {
  post_date: string;
  timezone: string;
  location: string | null;
  notes: NoteSnapshot[];
  completed_tasks: { title: string; priority: string; updated_at: string }[];
  priorities: { title: string; tier: string; done: boolean }[];
  mood: {
    mood: number;
    energy: number | null;
    stress: number | null;
    note: string | null;
  } | null;
  weather: {
    location: string;
    temp: number;
    description: string;
  } | null;
  calendar: {
    title: string;
    starts_at: string;
    ends_at: string | null;
    source: "local" | "google";
  }[];
  habits: { name: string; completed: boolean }[];
  water: { glasses: number; goal: number } | null;
  time_tracking: [];
};

export type DayRange = {
  postDate: string;
  startUtc: string;
  endUtc: string;
  localHour: number;
};
