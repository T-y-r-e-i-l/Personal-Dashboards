"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

type WeatherResponse = {
  location: string;
  temp: number;
  feelsLike: number;
  description: string;
  humidity: number;
  wind: number;
  demo?: boolean;
};

export function WeatherPanel({
  userId,
  location,
}: {
  userId?: string;
  location?: string | null;
}) {
  const showToast = useToast((s) => s.show);
  const [savedLocation, setSavedLocation] = useState(location?.trim() || "");
  const [draft, setDraft] = useState(location ?? "");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    const next = location?.trim() || "";
    setSavedLocation(next);
    setDraft(next);
  }, [location]);

  const activeLocation = savedLocation || null;

  const query = useQuery({
    queryKey: ["weather", activeLocation, coords?.lat, coords?.lon],
    enabled: Boolean(activeLocation || coords),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (coords) {
        params.set("lat", String(coords.lat));
        params.set("lon", String(coords.lon));
      } else if (activeLocation) {
        params.set("q", activeLocation);
      }

      const res = await fetch(`/api/weather?${params.toString()}`);
      const body = (await res.json().catch(() => ({}))) as WeatherResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? "Weather unavailable");
      }
      return body;
    },
    retry: 1,
  });

  const saveLocation = useMutation({
    mutationFn: async (value: string) => {
      if (!userId) throw new Error("Sign in to save location");
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          location: value,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw error;
      return value;
    },
    onSuccess: (value) => {
      setCoords(null);
      setSavedLocation(value);
      setDraft(value);
      showToast("Location saved");
    },
    onError: (err: Error) => showToast(err.message),
  });

  function onSaveLocation(e: FormEvent) {
    e.preventDefault();
    const value = draft.trim();
    if (!value) return;
    saveLocation.mutate(value);
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported in this browser");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        showToast("Could not get device location. Enter a city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  if (!activeLocation && !coords) {
    return (
      <div className="space-y-3">
        <EmptyState message="Add a city to show local weather." />
        <form onSubmit={onSaveLocation} className="space-y-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Spokane, WA"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saveLocation.isPending || !draft.trim()}
              className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)] disabled:opacity-50"
            >
              {saveLocation.isPending ? "Saving…" : "Save city"}
            </button>
            <button
              type="button"
              onClick={useDeviceLocation}
              disabled={geoLoading}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {geoLoading ? "Locating…" : "Use my location"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (query.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-3">
        <EmptyState
          message={
            query.error instanceof Error
              ? query.error.message
              : "Weather unavailable"
          }
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
        <form onSubmit={onSaveLocation} className="space-y-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Try another city, e.g. Seattle, WA"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={saveLocation.isPending || !draft.trim()}
            className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)] disabled:opacity-50"
          >
            Update city
          </button>
        </form>
      </div>
    );
  }

  const w = query.data;

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-xs text-[var(--muted)]">
          {w.location}
          {w.demo ? " · demo" : ""}
        </p>
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
