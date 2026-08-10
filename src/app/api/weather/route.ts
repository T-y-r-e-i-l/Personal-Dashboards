import { NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z.object({
  q: z.string().min(1).max(120),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ q: searchParams.get("q") });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // Graceful demo fallback when key is missing
    return NextResponse.json({
      location: parsed.data.q,
      temp: 68,
      feelsLike: 66,
      description: "partly cloudy",
      humidity: 55,
      wind: 6,
      demo: true,
    });
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", parsed.data.q);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("appid", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 600 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Weather unavailable" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      name: string;
      sys?: { country?: string };
      main: { temp: number; feels_like: number; humidity: number };
      weather: { description: string }[];
      wind: { speed: number };
    };

    return NextResponse.json({
      location: [data.name, data.sys?.country].filter(Boolean).join(", "),
      temp: data.main.temp,
      feelsLike: data.main.feels_like,
      description: data.weather[0]?.description ?? "clear",
      humidity: data.main.humidity,
      wind: data.wind.speed,
    });
  } catch {
    return NextResponse.json(
      { error: "Weather unavailable" },
      { status: 502 },
    );
  }
}
