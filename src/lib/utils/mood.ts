import { format, parseISO, subDays } from "date-fns";
import { averageMood } from "@/lib/utils/habits";

export type MoodDateRange = "7d" | "30d" | "90d";

export type MoodLogLike = {
  id: string;
  log_date: string;
  logged_at?: string | null;
  mood: number;
  energy: number | null;
  stress: number | null;
  note: string | null;
};

export type MoodDayAverage = {
  log_date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  count: number;
};

export function normalizeMoodDateRange(
  value: string | undefined,
): MoodDateRange {
  if (value === "7d" || value === "30d" || value === "90d") return value;
  if (value === "6m" || value === "1y") return "90d";
  return "7d";
}

export function moodRangeDayCount(range: MoodDateRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
  }
}

export function moodRangeLabel(range: MoodDateRange): string {
  switch (range) {
    case "7d":
      return "last 7 days";
    case "30d":
      return "last 30 days";
    case "90d":
      return "last 90 days";
  }
}

export function moodRangeStartDate(
  endDay: string,
  range: MoodDateRange,
): string {
  const end = parseISO(`${endDay}T12:00:00`);
  return format(subDays(end, moodRangeDayCount(range) - 1), "yyyy-MM-dd");
}

function avgNullable(values: number[]): number | null {
  return averageMood(values);
}

/** Aggregate check-ins into one chart point per calendar day. */
export function aggregateMoodByDay(logs: MoodLogLike[]): MoodDayAverage[] {
  const byDate = new Map<
    string,
    { moods: number[]; energies: number[]; stresses: number[] }
  >();

  for (const log of logs) {
    const bucket = byDate.get(log.log_date) ?? {
      moods: [],
      energies: [],
      stresses: [],
    };
    bucket.moods.push(log.mood);
    if (typeof log.energy === "number") bucket.energies.push(log.energy);
    if (typeof log.stress === "number") bucket.stresses.push(log.stress);
    byDate.set(log.log_date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([log_date, bucket]) => ({
      log_date,
      mood: avgNullable(bucket.moods),
      energy: avgNullable(bucket.energies),
      stress: avgNullable(bucket.stresses),
      count: bucket.moods.length,
    }));
}

export function latestMoodLog(
  logs: MoodLogLike[],
  day?: string,
): MoodLogLike | null {
  const scoped = day ? logs.filter((l) => l.log_date === day) : logs;
  if (scoped.length === 0) return null;
  return [...scoped].sort((a, b) => {
    const aTime = a.logged_at ?? `${a.log_date}T12:00:00`;
    const bTime = b.logged_at ?? `${b.log_date}T12:00:00`;
    return bTime.localeCompare(aTime);
  })[0];
}

/** Consecutive days ending on `endDay` that have at least one log. */
export function moodLogStreak(
  logs: MoodLogLike[],
  endDay: string,
): number {
  const days = new Set(logs.map((l) => l.log_date));
  let streak = 0;
  let cursor = parseISO(`${endDay}T12:00:00`);

  if (!days.has(endDay)) {
    cursor = subDays(cursor, 1);
  }

  while (days.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

/** Combine a calendar date + HH:mm into an ISO timestamptz string (local). */
export function combineDateAndTime(
  day: string,
  timeHm: string,
): string {
  const [hours, minutes] = timeHm.split(":").map(Number);
  const base = parseISO(`${day}T12:00:00`);
  base.setHours(
    Number.isFinite(hours) ? hours : 12,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return base.toISOString();
}

export function timeInputFromIso(iso: string | null | undefined): string {
  if (!iso) {
    return format(new Date(), "HH:mm");
  }
  return format(parseISO(iso), "HH:mm");
}
