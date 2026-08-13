import { addDays, format, parseISO } from "date-fns";
import type { SleepLog, SleepRating } from "@/lib/database.types";

export const SLEEP_WINDOW_DAYS = 7;

export const SLEEP_RATINGS: { value: SleepRating; label: string }[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

const RATING_TO_SCORE: Record<SleepRating, number> = {
  poor: 1,
  fair: 2,
  good: 3,
  excellent: 4,
};

const SCORE_TO_RATING: SleepRating[] = [
  "poor",
  "fair",
  "good",
  "excellent",
];

/** Minutes after 18:00 local, wrapping into the next calendar day. */
const BEDTIME_ORIGIN_HOUR = 18;
const MINUTES_PER_DAY = 24 * 60;

export type SleepChartPoint = {
  sleep_date: string;
  durationHours: number | null;
  score: number | null;
};

export type SleepSummary = {
  count: number;
  windowDays: number;
  avgDurationMinutes: number | null;
  avgScore: number | null;
  avgBedtimeLabel: string | null;
  avgRating: SleepRating | null;
  chartPoints: SleepChartPoint[];
};

export function formatDurationMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total % 60);
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function ratingLabel(rating: SleepRating): string {
  return SLEEP_RATINGS.find((r) => r.value === rating)?.label ?? rating;
}

/** Inclusive window of `days` calendar dates ending on `endDate` (yyyy-MM-dd). */
export function sleepWindowDates(
  endDate: string,
  days = SLEEP_WINDOW_DAYS,
): string[] {
  const end = parseISO(`${endDate}T12:00:00`);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(format(addDays(end, -i), "yyyy-MM-dd"));
  }
  return dates;
}

function bedtimeOffsetMinutes(startedAt: string): number {
  const d = new Date(startedAt);
  const minutesOfDay = d.getHours() * 60 + d.getMinutes();
  const origin = BEDTIME_ORIGIN_HOUR * 60;
  return (minutesOfDay - origin + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function formatBedtimeFromOffset(offsetMinutes: number): string {
  const total = (BEDTIME_ORIGIN_HOUR * 60 + Math.round(offsetMinutes)) %
    MINUTES_PER_DAY;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function circularMeanOffset(offsets: number[]): number | null {
  if (offsets.length === 0) return null;
  const angleScale = (2 * Math.PI) / MINUTES_PER_DAY;
  let sinSum = 0;
  let cosSum = 0;
  for (const offset of offsets) {
    const angle = offset * angleScale;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }
  const meanAngle = Math.atan2(sinSum / offsets.length, cosSum / offsets.length);
  const normalized = (meanAngle + 2 * Math.PI) % (2 * Math.PI);
  return normalized / angleScale;
}

function averageRating(ratings: SleepRating[]): SleepRating | null {
  if (ratings.length === 0) return null;
  const mean =
    ratings.reduce((sum, r) => sum + RATING_TO_SCORE[r], 0) / ratings.length;
  const idx = Math.min(
    SCORE_TO_RATING.length - 1,
    Math.max(0, Math.round(mean) - 1),
  );
  return SCORE_TO_RATING[idx] ?? null;
}

export function summarizeSleepLogs(
  logs: SleepLog[],
  endDate: string,
  days = SLEEP_WINDOW_DAYS,
): SleepSummary {
  const windowDates = sleepWindowDates(endDate, days);
  const byDate = new Map(logs.map((log) => [log.sleep_date, log]));
  const present = windowDates
    .map((d) => byDate.get(d))
    .filter((log): log is SleepLog => Boolean(log));

  const chartPoints: SleepChartPoint[] = windowDates.map((sleep_date) => {
    const log = byDate.get(sleep_date);
    return {
      sleep_date,
      durationHours: log ? log.duration_minutes / 60 : null,
      score: log ? log.score : null,
    };
  });

  if (present.length === 0) {
    return {
      count: 0,
      windowDays: days,
      avgDurationMinutes: null,
      avgScore: null,
      avgBedtimeLabel: null,
      avgRating: null,
      chartPoints,
    };
  }

  const avgDurationMinutes =
    present.reduce((sum, log) => sum + log.duration_minutes, 0) /
    present.length;
  const avgScore = Math.round(
    present.reduce((sum, log) => sum + log.score, 0) / present.length,
  );
  const meanOffset = circularMeanOffset(
    present.map((log) => bedtimeOffsetMinutes(log.started_at)),
  );

  return {
    count: present.length,
    windowDays: days,
    avgDurationMinutes,
    avgScore,
    avgBedtimeLabel:
      meanOffset == null ? null : formatBedtimeFromOffset(meanOffset),
    avgRating: averageRating(present.map((log) => log.rating)),
    chartPoints,
  };
}
