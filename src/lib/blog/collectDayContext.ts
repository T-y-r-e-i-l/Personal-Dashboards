import type { SupabaseClient } from "@supabase/supabase-js";
import { getDayRange } from "@/lib/blog/dayRange";
import { fetchWeatherSnapshot } from "@/lib/blog/weatherSnapshot";
import type { DayContext, NoteSnapshot } from "@/lib/blog/types";
import { listGoogleEvents } from "@/lib/google/calendar";
import { getValidGoogleAccessToken } from "@/lib/google/connection";

export async function collectDayContext(
  supabase: SupabaseClient,
  userId: string,
  timezone: string,
  location: string | null,
  now = new Date(),
): Promise<{ range: ReturnType<typeof getDayRange>; context: DayContext }> {
  const range = getDayRange(timezone, now);

  const [
    capturesRes,
    tasksRes,
    prioritiesRes,
    moodRes,
    habitsRes,
    habitLogsRes,
    waterRes,
    timeRes,
    weather,
  ] = await Promise.all([
    supabase
      .from("captures")
      .select("id, content, visibility, created_at")
      .eq("user_id", userId)
      .gte("created_at", range.startUtc)
      .lt("created_at", range.endUtc)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("title, priority, updated_at, status")
      .eq("user_id", userId)
      .eq("status", "done")
      .gte("updated_at", range.startUtc)
      .lt("updated_at", range.endUtc),
    supabase
      .from("daily_priorities")
      .select("title, tier, done")
      .eq("user_id", userId)
      .eq("priority_date", range.postDate),
    supabase
      .from("mood_logs")
      .select("mood, energy, stress, note, logged_at, log_date")
      .eq("user_id", userId)
      .eq("log_date", range.postDate)
      .order("logged_at", { ascending: false })
      .limit(1),
    supabase
      .from("habits")
      .select("id, name")
      .eq("user_id", userId)
      .eq("active", true),
    supabase
      .from("habit_logs")
      .select("habit_id, completed")
      .eq("user_id", userId)
      .eq("log_date", range.postDate),
    supabase
      .from("water_logs")
      .select("glasses, goal")
      .eq("user_id", userId)
      .eq("log_date", range.postDate)
      .maybeSingle(),
    supabase
      .from("time_entries")
      .select("description, started_at, ended_at, tasks(title)")
      .eq("user_id", userId)
      .lt("started_at", range.endUtc)
      .or(`ended_at.is.null,ended_at.gte.${range.startUtc}`)
      .order("started_at", { ascending: true }),
    fetchWeatherSnapshot(location),
  ]);

  if (capturesRes.error) throw capturesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (prioritiesRes.error) throw prioritiesRes.error;
  if (habitsRes.error) throw habitsRes.error;
  if (habitLogsRes.error) throw habitLogsRes.error;
  if (waterRes.error) throw waterRes.error;
  // time_entries may be missing before migration — treat as empty
  const timeEntriesOk = !timeRes.error;

  let moodData: unknown = moodRes.data;
  if (moodRes.error) {
    if (!/column|schema cache|logged_at/i.test(moodRes.error.message)) {
      throw moodRes.error;
    }
    const fallback = await supabase
      .from("mood_logs")
      .select("mood, energy, stress, note")
      .eq("user_id", userId)
      .eq("log_date", range.postDate)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fallback.error) throw fallback.error;
    moodData = fallback.data;
  }

  type CaptureRow = {
    id: string;
    content: string;
    visibility?: string | null;
    created_at: string;
  };
  type TaskRow = { title: string; priority: string; updated_at: string };
  type PriorityRow = { title: string; tier: string; done: boolean };
  type MoodRow = {
    mood: number;
    energy: number | null;
    stress: number | null;
    note: string | null;
  };
  type HabitRow = { id: string; name: string };
  type HabitLogRow = { habit_id: string; completed: boolean };
  type WaterRow = { glasses: number; goal: number };
  type TimeRow = {
    description: string;
    started_at: string;
    ended_at: string | null;
    tasks?: { title: string } | null;
  };

  const captures = (capturesRes.data ?? []) as CaptureRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const priorities = (prioritiesRes.data ?? []) as PriorityRow[];
  const moodRows = (moodData ?? []) as MoodRow[];
  const mood = moodRows[0] ?? null;
  const habits = (habitsRes.data ?? []) as HabitRow[];
  const habitLogs = (habitLogsRes.data ?? []) as HabitLogRow[];
  const water = (waterRes.data ?? null) as WaterRow | null;
  const timeRows = (
    timeEntriesOk ? (timeRes.data ?? []) : []
  ) as unknown as TimeRow[];

  const dayStart = new Date(range.startUtc).getTime();
  const dayEnd = new Date(range.endUtc).getTime();
  const time_tracking: DayContext["time_tracking"] = timeRows.map((entry) => {
    const start = Math.max(dayStart, new Date(entry.started_at).getTime());
    const endRaw = entry.ended_at
      ? new Date(entry.ended_at).getTime()
      : Math.min(dayEnd, Date.now());
    const end = Math.min(dayEnd, endRaw);
    const minutes = Math.max(0, Math.round((end - start) / 60_000));
    const taskTitle = Array.isArray(entry.tasks)
      ? (entry.tasks[0]?.title ?? null)
      : (entry.tasks?.title ?? null);
    return {
      description: entry.description,
      task_title: taskTitle,
      minutes,
      started_at: entry.started_at,
      ended_at: entry.ended_at,
    };
  });

  const notes: NoteSnapshot[] = captures.map((row) => ({
    id: row.id,
    content: row.content,
    visibility: row.visibility === "public" ? "public" : "private",
    created_at: row.created_at,
  }));

  const habitLogById = new Map(
    habitLogs.map((log) => [log.habit_id, log.completed]),
  );

  const calendar: DayContext["calendar"] = [];

  try {
    let token = await getValidGoogleAccessToken(supabase, userId);
    if (token) {
      try {
        const googleEvents = await listGoogleEvents(
          token.accessToken,
          range.startUtc,
          range.endUtc,
        );
        for (const event of googleEvents) {
          calendar.push({
            title: event.title,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            source: "google",
          });
        }
      } catch {
        token = await getValidGoogleAccessToken(supabase, userId, {
          forceRefresh: true,
        });
        if (token) {
          const googleEvents = await listGoogleEvents(
            token.accessToken,
            range.startUtc,
            range.endUtc,
          );
          for (const event of googleEvents) {
            calendar.push({
              title: event.title,
              starts_at: event.starts_at,
              ends_at: event.ends_at,
              source: "google",
            });
          }
        }
      }
    }
  } catch {
    // Google optional for digests
  }

  calendar.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  const context: DayContext = {
    post_date: range.postDate,
    timezone,
    location,
    notes,
    completed_tasks: tasks.map((task) => ({
      title: task.title,
      priority: task.priority,
      updated_at: task.updated_at,
    })),
    priorities: priorities.map((p) => ({
      title: p.title,
      tier: p.tier,
      done: p.done,
    })),
    mood: mood
      ? {
          mood: mood.mood,
          energy: mood.energy,
          stress: mood.stress,
          note: mood.note,
        }
      : null,
    weather,
    calendar,
    habits: habits.map((habit) => ({
      name: habit.name,
      completed: Boolean(habitLogById.get(habit.id)),
    })),
    water: water ? { glasses: water.glasses, goal: water.goal } : null,
    time_tracking,
  };

  return { range, context };
}
