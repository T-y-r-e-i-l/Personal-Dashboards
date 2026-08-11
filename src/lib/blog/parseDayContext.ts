import type { DayContext } from "@/lib/blog/types";

export function parseDayContextWeather(
  raw: unknown,
): DayContext["weather"] | null {
  if (!raw || typeof raw !== "object") return null;
  const weather = (raw as { weather?: unknown }).weather;
  if (!weather || typeof weather !== "object") return null;
  const w = weather as Record<string, unknown>;
  if (
    typeof w.location !== "string" ||
    typeof w.temp !== "number" ||
    typeof w.description !== "string"
  ) {
    return null;
  }
  return {
    location: w.location,
    temp: w.temp,
    description: w.description,
  };
}
