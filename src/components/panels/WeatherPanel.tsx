"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";

type WeatherResponse = {
  location: string;
  temp: number;
  feelsLike: number;
  description: string;
  humidity: number;
  wind: number;
};

export function WeatherPanel({ location }: { location?: string | null }) {
  const query = useQuery({
    queryKey: ["weather", location],
    enabled: Boolean(location),
    queryFn: async () => {
      const res = await fetch(
        `/api/weather?q=${encodeURIComponent(location!)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Weather unavailable");
      }
      return (await res.json()) as WeatherResponse;
    },
    retry: 1,
  });

  if (!location) {
    return (
      <EmptyState message="Set your location in Settings to see weather." />
    );
  }

  if (query.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Weather unavailable"
        }
        actionLabel="Retry"
        onAction={() => void query.refetch()}
      />
    );
  }

  const w = query.data;

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-xs text-[var(--muted)]">{w.location}</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">
          {Math.round(w.temp)}°
        </p>
        <p className="capitalize text-sm text-[var(--muted)]">
          {w.description}
        </p>
      </div>
      <div className="space-y-1 text-xs text-[var(--muted)]">
        <p>Feels like {Math.round(w.feelsLike)}°</p>
        <p>Humidity {w.humidity}%</p>
        <p>Wind {Math.round(w.wind)} mph</p>
      </div>
    </div>
  );
}
