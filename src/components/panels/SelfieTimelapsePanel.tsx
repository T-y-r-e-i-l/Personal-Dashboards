"use client";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PanelConfig } from "@/lib/panels/types";
import {
  fetchSelfiesInRange,
  resolveSelfieFrames,
  selfieRangeBounds,
  type SelfieRange,
} from "@/lib/selfie/storage";

const DEFAULT_FPS = 4;
const MIN_FPS = 1;
const MAX_FPS = 12;

function normalizeSelfieRange(value: PanelConfig["selfieRange"]): SelfieRange {
  if (value === "90d" || value === "all") return value;
  return "30d";
}

function clampFps(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_FPS;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(value)));
}

function formatFrameDate(selfieDate: string) {
  try {
    return format(parseISO(selfieDate), "MMM d, yyyy");
  } catch {
    return selfieDate;
  }
}

export function SelfieTimelapsePanel({
  userId,
  date,
  timeZone,
  config,
}: {
  userId: string;
  date?: string;
  readOnly?: boolean;
  timeZone?: string;
  config?: PanelConfig;
}) {
  const supabase = createClient();
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const range = normalizeSelfieRange(config?.selfieRange);
  const bounds = selfieRangeBounds(tz, range, date);
  const [fps, setFps] = useState(() =>
    clampFps(config?.timelapseFps ?? DEFAULT_FPS),
  );
  const [playing, setPlaying] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setFps(clampFps(config?.timelapseFps ?? DEFAULT_FPS));
  }, [config?.timelapseFps]);

  const frames = useQuery({
    queryKey: [
      "daily-selfie-timelapse",
      userId,
      range,
      bounds.startDate,
      bounds.endDate,
    ],
    queryFn: async () => {
      const rows = await fetchSelfiesInRange(supabase, userId, {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      });
      return resolveSelfieFrames(supabase, rows);
    },
  });

  const list = frames.data ?? [];

  useEffect(() => {
    setIndex(0);
  }, [range, bounds.startDate, bounds.endDate, list.length]);

  useEffect(() => {
    if (!playing || list.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % list.length);
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [playing, fps, list.length]);

  useEffect(() => {
    if (list.length < 2) return;
    const next = list[(index + 1) % list.length];
    if (!next) return;
    const img = new Image();
    img.src = next.url;
  }, [index, list]);

  if (frames.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading timelapse…</p>;
  }

  if (frames.isError) {
    return (
      <p className="text-sm text-[var(--danger)]">
        {frames.error.message || "Could not load selfies."}
      </p>
    );
  }

  if (list.length < 2) {
    return (
      <EmptyState message="Capture more daily selfies to build a timelapse." />
    );
  }

  const current = list[Math.min(index, list.length - 1)]!;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.url}
          src={current.url}
          alt={`Selfie from ${current.selfieDate}`}
          className="h-full w-full scale-x-[-1] object-cover"
        />
      </div>

      <p className="text-center text-xs text-[var(--muted)]">
        {formatFrameDate(current.selfieDate)}
        <span className="mx-1.5 text-[var(--border)]">·</span>
        {index + 1}/{list.length}
      </p>

      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)]"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-[var(--muted)]">
            <span className="shrink-0 tabular-nums">{fps} fps</span>
            <input
              type="range"
              min={MIN_FPS}
              max={MAX_FPS}
              step={1}
              value={fps}
              onChange={(e) => setFps(clampFps(Number(e.target.value)))}
              className="min-w-0 flex-1 accent-[var(--ink)]"
              aria-label="Playback speed in frames per second"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
