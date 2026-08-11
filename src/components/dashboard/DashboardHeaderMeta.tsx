"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

type WeatherResponse = {
  location: string;
  temp: number;
  description: string;
  demo?: boolean;
};

function formatInZone(
  date: Date,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || undefined,
    ...options,
  }).format(date);
}

function Separator() {
  return <span className="mx-2 text-[var(--muted)]/50">|</span>;
}

export function DashboardHeaderMeta({
  location,
  timezone,
  variant = "stack",
}: {
  location?: string | null;
  timezone?: string | null;
  variant?: "stack" | "inline";
}) {
  const [now, setNow] = useState(() => new Date());
  const zone = timezone?.trim() || undefined;
  const place = location?.trim() || null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const weather = useQuery({
    // Align with WeatherPanel so both share cache for the same city.
    queryKey: ["weather", place, undefined, undefined],
    enabled: Boolean(place),
    queryFn: async () => {
      const res = await fetch(`/api/weather?q=${encodeURIComponent(place!)}`);
      const body = (await res.json().catch(() => ({}))) as WeatherResponse & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Weather unavailable");
      return body;
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const dateLabel = formatInZone(now, zone, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeLabel = formatInZone(now, zone, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  const weatherLabel = weather.data
    ? `${Math.round(weather.data.temp)}° · ${weather.data.description}${
        weather.data.demo ? " · demo" : ""
      }`
    : place && weather.isLoading
      ? "Weather…"
      : place && weather.isError
        ? "Weather unavailable"
        : null;

  if (variant === "inline") {
    return (
      <p className="mt-2 text-sm text-[var(--muted)]">
        <span>{dateLabel}</span>
        <Separator />
        <span className="tabular-nums">{timeLabel}</span>
        <Separator />
        {weatherLabel ? (
          <span className="capitalize">{weatherLabel}</span>
        ) : (
          <Link
            href="/settings"
            className="underline-offset-2 hover:text-[var(--ink)] hover:underline"
          >
            Set location for weather
          </Link>
        )}
      </p>
    );
  }

  return (
    <div className="min-w-[10rem] text-left md:text-right">
      <p className="text-sm font-medium text-[var(--ink)]">{dateLabel}</p>
      <p className="mt-0.5 font-mono text-2xl tabular-nums tracking-tight text-[var(--ink)]">
        {timeLabel}
      </p>
      <div className="mt-1 text-sm text-[var(--muted)]">
        {weatherLabel ? (
          <p className="capitalize">{weatherLabel}</p>
        ) : (
          <Link
            href="/settings"
            className="underline-offset-2 hover:text-[var(--ink)] hover:underline"
          >
            Set location for weather
          </Link>
        )}
      </div>
    </div>
  );
}
