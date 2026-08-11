import {
  addDays,
  addWeeks,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";

export function computeStreak(
  completedDates: string[],
  today = new Date(),
): number {
  const set = new Set(completedDates);
  let streak = 0;
  let cursor = today;

  // If today isn't done, start from yesterday
  if (!set.has(format(cursor, "yyyy-MM-dd"))) {
    cursor = subDays(cursor, 1);
  }

  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

export function lastNDays(n: number, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) =>
    format(subDays(from, n - 1 - i), "yyyy-MM-dd"),
  );
}

export type ContributionCell = {
  date: string;
  /** Sunday = 0 … Saturday = 6 */
  dayOfWeek: number;
  inRange: boolean;
};

export type ContributionWeek = {
  days: ContributionCell[];
  /** Month label for the first day of a new month in this week, else null */
  monthLabel: string | null;
};

/** GitHub-style week columns (Sun→Sat), ending on the week that contains `end`. */
export function buildContributionWeeks(
  end: Date,
  weekCount = 53,
  /** Inclusive start of the active window (cells before this are empty padding). */
  activeStart?: Date,
): ContributionWeek[] {
  const endDay = startOfDay(end);
  const endWeekStart = startOfWeek(endDay, { weekStartsOn: 0 });
  const firstWeekStart = subWeeks(endWeekStart, weekCount - 1);
  const activeStartDay = activeStart ? startOfDay(activeStart) : null;
  const rangeStart =
    activeStartDay && activeStartDay > firstWeekStart
      ? activeStartDay
      : firstWeekStart;
  let previousMonth = -1;
  const weeks: ContributionWeek[] = [];

  for (let w = 0; w < weekCount; w += 1) {
    const weekStart = addWeeks(firstWeekStart, w);
    const days: ContributionCell[] = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const key = format(date, "yyyy-MM-dd");
      return {
        date: key,
        dayOfWeek: i,
        inRange: date >= rangeStart && date <= endDay,
      };
    });

    const monthAnchor = days.find((d) => d.inRange) ?? days[0];
    const month = parseISO(`${monthAnchor.date}T12:00:00`).getMonth();
    const monthLabel =
      month !== previousMonth
        ? format(parseISO(`${monthAnchor.date}T12:00:00`), "MMM")
        : null;
    if (monthLabel) previousMonth = month;

    weeks.push({ days, monthLabel });
  }

  return weeks;
}

export type HabitDateRange = "7d" | "30d" | "6m" | "1y";

export function normalizeHabitDateRange(
  value: string | undefined,
): HabitDateRange {
  if (value === "7d" || value === "30d" || value === "6m" || value === "1y") {
    return value;
  }
  if (value === "90d") return "6m";
  return "7d";
}

/** Calendar weeks to render for a habit range view. */
export function habitRangeWeekCount(range: HabitDateRange): number {
  switch (range) {
    case "7d":
      return 2;
    case "30d":
      return 5;
    case "6m":
      return 26;
    case "1y":
      return 53;
  }
}

/** Inclusive day span for the active habit range. */
export function habitRangeDayCount(range: HabitDateRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "6m":
      return 183;
    case "1y":
      return 365;
  }
}

export function habitRangeLabel(range: HabitDateRange): string {
  switch (range) {
    case "7d":
      return "last 7 days";
    case "30d":
      return "last 30 days";
    case "6m":
      return "last 6 months";
    case "1y":
      return "last year";
  }
}

/** Map completion count to GitHub-like intensity 0–4. */
export function contributionLevel(
  completedCount: number,
  habitCount: number,
): 0 | 1 | 2 | 3 | 4 {
  if (habitCount <= 0 || completedCount <= 0) return 0;
  if (completedCount >= habitCount) return 4;
  const ratio = completedCount / habitCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function averageMood(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function waterProgress(glasses: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((glasses / goal) * 100));
}

export function isSameDay(isoDate: string, day: Date): boolean {
  return format(parseISO(isoDate), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
}
