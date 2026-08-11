import type { DayRange } from "@/lib/blog/types";

function partsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const bag = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * Iterates to correct for timezone offset / DST.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const asLocal = partsInTimeZone(new Date(utc), timeZone);
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actual = Date.UTC(
      asLocal.year,
      asLocal.month - 1,
      asLocal.day,
      asLocal.hour,
      asLocal.minute,
      0,
    );
    utc += desired - actual;
  }
  return new Date(utc);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  delta: number,
) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function getDayRange(timeZone: string, now = new Date()): DayRange {
  const local = partsInTimeZone(now, timeZone);
  const postDate = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;

  const start = zonedTimeToUtc(
    local.year,
    local.month,
    local.day,
    0,
    0,
    timeZone,
  );
  const next = addCalendarDays(local.year, local.month, local.day, 1);
  const end = zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone);

  return {
    postDate,
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    localHour: local.hour,
  };
}

export function formatPostDateTitle(postDate: string) {
  const [y, m, d] = postDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}
