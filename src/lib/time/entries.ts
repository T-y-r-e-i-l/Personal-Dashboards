import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatTimeTrackedActivity,
  logActivity,
} from "@/lib/activity/logActivity";
import type { TimeEntry } from "@/lib/database.types";
import type { TimerMode } from "@/lib/time/pomodoro";

export const TIME_ENTRIES_KEY = "time-entries";
export const TIME_RUNNING_KEY = "time-running";

export type TimeEntryRow = TimeEntry & {
  tasks?: { title: string } | null;
};

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function elapsedMs(
  startedAt: string,
  endedAt?: string | null,
  now = Date.now(),
) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  return Math.max(0, end - start);
}

export async function fetchRunningEntry(
  supabase: SupabaseClient,
  userId: string,
): Promise<TimeEntryRow | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, tasks(title)")
    .eq("user_id", userId)
    .is("ended_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data as TimeEntryRow | null) ?? null;
}

export async function stopRunningEntry(
  supabase: SupabaseClient,
  userId: string,
  endedAt = new Date().toISOString(),
): Promise<TimeEntryRow | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .update({ ended_at: endedAt })
    .eq("user_id", userId)
    .is("ended_at", null)
    .select("*, tasks(title)")
    .maybeSingle();

  if (error) throw error;
  const entry = (data as TimeEntryRow | null) ?? null;
  if (entry?.started_at) {
    try {
      await logActivity(supabase, {
        userId,
        kind: "time",
        at: endedAt,
        content: formatTimeTrackedActivity({
          description: entry.description ?? "",
          taskTitle: entry.tasks?.title,
          startedAt: entry.started_at,
          endedAt,
        }),
      });
    } catch {
      // Timer stop should succeed even if the activity feed write fails.
    }
  }
  return entry;
}

export async function startTimer(
  supabase: SupabaseClient,
  {
    userId,
    taskId,
    description,
    timerMode = "stopwatch",
    plannedSeconds = null,
  }: {
    userId: string;
    taskId?: string | null;
    description?: string;
    timerMode?: TimerMode;
    plannedSeconds?: number | null;
  },
): Promise<TimeEntryRow> {
  await stopRunningEntry(supabase, userId);

  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      user_id: userId,
      task_id: taskId ?? null,
      description: (description ?? "").trim(),
      started_at: startedAt,
      ended_at: null,
      timer_mode: timerMode ?? "stopwatch",
      planned_seconds:
        timerMode && timerMode !== "stopwatch"
          ? (plannedSeconds ?? null)
          : null,
    })
    .select("*, tasks(title)")
    .single();

  if (error) {
    // Unique race: stop again and retry once
    if (error.code === "23505") {
      await stopRunningEntry(supabase, userId);
      const retry = await supabase
        .from("time_entries")
        .insert({
          user_id: userId,
          task_id: taskId ?? null,
          description: (description ?? "").trim(),
          started_at: new Date().toISOString(),
          ended_at: null,
          timer_mode: timerMode ?? "stopwatch",
          planned_seconds:
            timerMode && timerMode !== "stopwatch"
              ? (plannedSeconds ?? null)
              : null,
        })
        .select("*, tasks(title)")
        .single();
      if (retry.error) throw retry.error;
      return retry.data as TimeEntryRow;
    }
    throw error;
  }

  return data as TimeEntryRow;
}

export async function deleteTimeEntry(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
) {
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) throw error;
}

export function todayBoundsLocal(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}
