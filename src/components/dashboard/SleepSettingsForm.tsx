"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, setHours, setMinutes, subDays } from "date-fns";
import { useEffect, useState, type MutableRefObject } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SleepLog, SleepRating } from "@/lib/database.types";

const RATINGS: { value: SleepRating; label: string }[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

type SleepDraft = {
  startedAt: string;
  endedAt: string;
  durationHours: string;
  durationMinutes: string;
  score: string;
  rating: SleepRating;
};

function toDatetimeLocal(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

function emptyDraft(sleepDate: string): SleepDraft {
  const wakeDay = parseISO(`${sleepDate}T12:00:00`);
  const start = setMinutes(setHours(subDays(wakeDay, 1), 22), 30);
  const end = setMinutes(setHours(wakeDay, 6), 30);
  return {
    startedAt: toDatetimeLocal(start.toISOString()),
    endedAt: toDatetimeLocal(end.toISOString()),
    durationHours: "",
    durationMinutes: "",
    score: "",
    rating: "good",
  };
}

function draftFromLog(log: SleepLog): SleepDraft {
  const hours = Math.floor(log.duration_minutes / 60);
  const minutes = log.duration_minutes % 60;
  return {
    startedAt: toDatetimeLocal(log.started_at),
    endedAt: toDatetimeLocal(log.ended_at),
    durationHours: String(hours),
    durationMinutes: String(minutes),
    score: String(log.score),
    rating: log.rating,
  };
}

export function SleepSettingsForm({
  userId,
  sleepDate,
  saveRef,
}: {
  userId: string;
  sleepDate: string;
  saveRef: MutableRefObject<(() => Promise<void>) | null>;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SleepDraft>(() => emptyDraft(sleepDate));
  const [hydrated, setHydrated] = useState(false);

  const log = useQuery({
    queryKey: ["sleep_logs", userId, sleepDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("sleep_date", sleepDate)
        .maybeSingle();
      if (error) throw error;
      return data as SleepLog | null;
    },
  });

  useEffect(() => {
    if (log.isLoading || hydrated) return;
    if (log.data) setDraft(draftFromLog(log.data));
    else setDraft(emptyDraft(sleepDate));
    setHydrated(true);
  }, [log.isLoading, log.data, sleepDate, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft.startedAt || !draft.endedAt) {
        throw new Error("Sleep start and end are required.");
      }
      const hours = Number(draft.durationHours || 0);
      const minutes = Number(draft.durationMinutes || 0);
      const durationMinutes = hours * 60 + minutes;
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        throw new Error("Enter wearable sleep duration.");
      }
      const score = Number(draft.score);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new Error("Score must be between 0 and 100.");
      }
      const startedAt = fromDatetimeLocal(draft.startedAt);
      const endedAt = fromDatetimeLocal(draft.endedAt);
      if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
        throw new Error("Sleep end must be after sleep start.");
      }

      const { error } = await supabase.from("sleep_logs").upsert(
        {
          user_id: userId,
          sleep_date: sleepDate,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: durationMinutes,
          score: Math.round(score),
          rating: draft.rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sleep_date" },
      );
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["sleep_logs", userId],
      });
    },
  });

  useEffect(() => {
    saveRef.current = async () => {
      await save.mutateAsync();
    };
    return () => {
      saveRef.current = null;
    };
  });

  if (log.isLoading || !hydrated) {
    return <p className="text-sm text-[var(--muted)]">Loading sleep…</p>;
  }

  if (log.isError) {
    return (
      <p className="text-sm text-[var(--danger)]">
        {log.error.message || "Could not load sleep log."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        {format(parseISO(`${sleepDate}T12:00:00`), "EEEE, MMM d")}
        {log.data ? " · Edit last night’s sleep" : " · Log last night’s sleep"}
      </p>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Sleep Start</span>
        <input
          type="datetime-local"
          required
          value={draft.startedAt}
          onChange={(e) =>
            setDraft((d) => ({ ...d, startedAt: e.target.value }))
          }
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Sleep End</span>
        <input
          type="datetime-local"
          required
          value={draft.endedAt}
          onChange={(e) =>
            setDraft((d) => ({ ...d, endedAt: e.target.value }))
          }
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
        />
      </label>

      <div className="block text-sm">
        <span className="mb-1.5 block font-medium">Sleep Duration</span>
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
            Hours
            <input
              type="number"
              min={0}
              max={24}
              inputMode="numeric"
              value={draft.durationHours}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  durationHours: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
            Minutes
            <input
              type="number"
              min={0}
              max={59}
              inputMode="numeric"
              value={draft.durationMinutes}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  durationMinutes: e.target.value,
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
            />
          </label>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Use the duration from your wearable, not clock time in bed.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Sleep Score</span>
        <input
          type="number"
          min={0}
          max={100}
          required
          inputMode="numeric"
          value={draft.score}
          onChange={(e) => setDraft((d) => ({ ...d, score: e.target.value }))}
          placeholder="0–100"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium">Sleep Rating</span>
        <select
          value={draft.rating}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              rating: e.target.value as SleepRating,
            }))
          }
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
        >
          {RATINGS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
