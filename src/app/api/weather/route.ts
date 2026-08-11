import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z
  .object({
    q: z.string().min(1).max(120).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => Boolean(v.q) || (v.lat !== undefined && v.lon !== undefined), {
    message: "Provide q or lat/lon",
  });

const US_STATE_CODES = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

/** OpenWeather rejects "City, ST"; prefer "City,ST,US" and plain city fallbacks. */
function locationCandidates(q: string): string[] {
  const trimmed = q.trim().replace(/\s+/g, " ");
  const out: string[] = [];
  const push = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };

  const stateMatch = trimmed.match(/^(.+),\s*([A-Za-z]{2})$/);
  if (stateMatch && US_STATE_CODES.has(stateMatch[2].toUpperCase())) {
    const city = stateMatch[1].trim();
    const state = stateMatch[2].toUpperCase();
    push(`${city},${state},US`);
    push(city);
  }

  push(trimmed);
  return out;
}

type GeoHit = {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  state?: string;
};

async function resolveByQuery(
  q: string,
  apiKey: string,
): Promise<GeoHit | null> {
  for (const candidate of locationCandidates(q)) {
    const url = new URL("https://api.openweathermap.org/geo/1.0/direct");
    url.searchParams.set("q", candidate);
    url.searchParams.set("limit", "1");
    url.searchParams.set("appid", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) continue;
    const hits = (await res.json()) as GeoHit[];
    if (Array.isArray(hits) && hits[0]) return hits[0];
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    lat: searchParams.get("lat") ?? undefined,
    lon: searchParams.get("lon") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      location: parsed.data.q ?? "Demo City",
      temp: 68,
      feelsLike: 66,
      description: "partly cloudy",
      humidity: 55,
      wind: 6,
      demo: true,
    });
  }

  try {
    let lat = parsed.data.lat;
    let lon = parsed.data.lon;
    let placeLabel: string | undefined;

    if (parsed.data.q) {
      const geo = await resolveByQuery(parsed.data.q, apiKey);
      if (!geo) {
        return NextResponse.json(
          {
            error:
              "City not found. Try “City”, “City, ST”, or “City, Country”.",
          },
          { status: 404 },
        );
      }
      lat = geo.lat;
      lon = geo.lon;
      placeLabel = [geo.name, geo.state, geo.country].filter(Boolean).join(", ");
    }

    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("units", "imperial");
    url.searchParams.set("appid", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 600 } });
    const payload = (await res.json()) as {
      message?: string;
      name?: string;
      sys?: { country?: string };
      main?: { temp: number; feels_like: number; humidity: number };
      weather?: { description: string }[];
      wind?: { speed: number };
    };

    if (!res.ok) {
      const message =
        typeof payload.message === "string"
          ? payload.message
          : "Weather unavailable";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (!payload.main || !payload.weather) {
      return NextResponse.json(
        { error: "Unexpected weather response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      location:
        placeLabel ??
        [payload.name, payload.sys?.country].filter(Boolean).join(", "),
      temp: payload.main.temp,
      feelsLike: payload.main.feels_like,
      description: payload.weather[0]?.description ?? "clear",
      humidity: payload.main.humidity,
      wind: payload.wind?.speed ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Weather unavailable" },
      { status: 502 },
    );
  }
}
