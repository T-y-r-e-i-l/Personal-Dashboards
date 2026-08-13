import type { DayContext } from "@/lib/blog/types";

export type AiSummaryBlock = {
  private_summary: string;
  public_summary: string;
  model: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseDayContextWeather(
  dayContext: unknown,
): DayContext["weather"] {
  if (!isRecord(dayContext)) return null;
  const weather = dayContext.weather;
  if (!isRecord(weather)) return null;
  if (
    typeof weather.location !== "string" ||
    typeof weather.temp !== "number" ||
    typeof weather.description !== "string"
  ) {
    return null;
  }
  return {
    location: weather.location,
    temp: weather.temp,
    description: weather.description,
  };
}

export function parseAiSummary(dayContext: unknown): AiSummaryBlock | null {
  if (!isRecord(dayContext)) return null;
  const ai = dayContext.ai_summary;
  if (!isRecord(ai)) return null;
  if (
    typeof ai.private_summary !== "string" ||
    typeof ai.public_summary !== "string" ||
    typeof ai.model !== "string"
  ) {
    return null;
  }
  return {
    private_summary: ai.private_summary,
    public_summary: ai.public_summary,
    model: ai.model,
  };
}
