import { format, parseISO, subDays } from "date-fns";

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
