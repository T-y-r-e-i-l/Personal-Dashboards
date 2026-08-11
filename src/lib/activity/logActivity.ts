import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDuration } from "@/lib/time/entries";

export type ActivityKind = "mood" | "todo" | "time";

/** Insert a private activity entry into the notes/captures feed. */
export async function logActivity(
  supabase: SupabaseClient,
  {
    userId,
    content,
    kind,
    at = new Date().toISOString(),
  }: {
    userId: string;
    content: string;
    kind: ActivityKind;
    at?: string;
  },
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;

  const attempts = [
    {
      user_id: userId,
      content: trimmed,
      visibility: "private" as const,
      tags: ["activity", kind],
      created_at: at,
      updated_at: at,
    },
    {
      user_id: userId,
      content: trimmed,
      visibility: "private" as const,
      created_at: at,
      updated_at: at,
    },
    {
      user_id: userId,
      content: trimmed,
      visibility: "private" as const,
      created_at: at,
    },
    {
      user_id: userId,
      content: trimmed,
      visibility: "private" as const,
    },
    {
      user_id: userId,
      content: trimmed,
    },
  ] as const;

  for (const row of attempts) {
    const { error } = await supabase.from("captures").insert(row);
    if (!error) return;
    if (!/column|schema cache/i.test(error.message)) throw error;
  }
}

export function formatMoodActivity(args: {
  mood: number;
  energy: number;
  stress: number;
  note?: string | null;
}): string {
  const metrics = `Mood ${args.mood} · Energy ${args.energy} · Stress ${args.stress}`;
  const note = args.note?.trim();
  if (note) return `${note}\n\n— Mood check-in · ${metrics}`;
  return `Mood check-in · ${metrics}`;
}

export function formatTodoCompletedActivity(title: string): string {
  return `Completed to-do · ${title.trim()}`;
}

export function formatTimeTrackedActivity(args: {
  description: string;
  taskTitle?: string | null;
  startedAt: string;
  endedAt: string;
}): string {
  const ms =
    new Date(args.endedAt).getTime() - new Date(args.startedAt).getTime();
  const duration = formatDuration(Math.max(0, ms));
  const label =
    args.description.trim() ||
    args.taskTitle?.trim() ||
    "Focus session";
  if (args.taskTitle && args.description.trim() && args.description.trim() !== args.taskTitle.trim()) {
    return `Tracked ${duration} · ${label} (${args.taskTitle.trim()})`;
  }
  return `Tracked ${duration} · ${label}`;
}
