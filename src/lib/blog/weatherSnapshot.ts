import type { DayContext } from "@/lib/blog/types";

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

export async function fetchWeatherSnapshot(
  location: string | null,
): Promise<DayContext["weather"]> {
  if (!location?.trim()) return null;

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    let lat: number | undefined;
    let lon: number | undefined;
    let placeLabel: string | undefined;

    for (const candidate of locationCandidates(location)) {
      const geoUrl = new URL("https://api.openweathermap.org/geo/1.0/direct");
      geoUrl.searchParams.set("q", candidate);
      geoUrl.searchParams.set("limit", "1");
      geoUrl.searchParams.set("appid", apiKey);
      const geoRes = await fetch(geoUrl.toString());
      if (!geoRes.ok) continue;
      const hits = (await geoRes.json()) as {
        name: string;
        lat: number;
        lon: number;
        country?: string;
        state?: string;
      }[];
      if (hits[0]) {
        lat = hits[0].lat;
        lon = hits[0].lon;
        placeLabel = [hits[0].name, hits[0].state, hits[0].country]
          .filter(Boolean)
          .join(", ");
        break;
      }
    }

    if (lat === undefined || lon === undefined) return null;

    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("units", "imperial");
    url.searchParams.set("appid", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      name?: string;
      main?: { temp: number };
      weather?: { description: string }[];
    };

    if (!payload.main || !payload.weather?.[0]) return null;

    return {
      location: placeLabel ?? payload.name ?? location,
      temp: payload.main.temp,
      description: payload.weather[0].description,
    };
  } catch {
    return null;
  }
}
