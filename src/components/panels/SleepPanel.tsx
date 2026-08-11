"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, setHours, setMinutes, subDays } from "date-fns";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { SleepLog, SleepRating } from "@/lib/database.types";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

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

function formatDurationMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function ratingLabel(rating: SleepRating): string {
  return RATINGS.find((r) => r.value === rating)?.label ?? rating;
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

export function SleepPanel({
  userId,
  date,
  readOnly = false,
}: {
  userId: string;
  date?: string;
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const sleepDate = date ?? format(new Date(), "yyyy-MM-dd");
  const interactive = !readOnly;

  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SleepDraft>(() => emptyDraft(sleepDate));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!logging) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelForm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logging]);

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
      setLogging(false);
      setEditing(false);
      showToast(editing ? "Sleep updated" : "Sleep logged");
      await queryClient.invalidateQueries({
        queryKey: ["sleep_logs", userId, sleepDate],
      });
    },
    onError: (err: Error) => showToast(err.message),
  });

  function startCreate() {
    setEditing(false);
    setDraft(emptyDraft(sleepDate));
    setLogging(true);
  }

  function startEdit() {
    if (!log.data) return;
    setEditing(true);
    setDraft(draftFromLog(log.data));
    setLogging(true);
  }

  function cancelForm() {
    setLogging(false);
    setEditing(false);
    setDraft(emptyDraft(sleepDate));
  }

  if (log.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (log.isError) {
    return (
      <EmptyState message={log.error.message || "Could not load sleep log."} />
    );
  }

  const night = log.data;

  if (!night && !logging) {
    return (
      <EmptyState
        message="Log last night's sleep from your wearable."
        actionLabel={interactive ? "Log sleep" : undefined}
        onAction={interactive ? startCreate : undefined}
      />
    );
  }

  const modal =
    logging && interactive && mounted ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        onClick={cancelForm}
      >
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="sleep-log-title"
          className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <h2
              id="sleep-log-title"
              className="font-[family-name:var(--font-display)] text-2xl"
            >
              {editing ? "Edit sleep" : "Log sleep"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {format(parseISO(`${sleepDate}T12:00:00`), "EEEE, MMM d")}
            </p>
          </div>

          <div className="mt-6 space-y-4">
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
                onChange={(e) =>
                  setDraft((d) => ({ ...d, score: e.target.value }))
                }
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

          <div className="mt-8 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)]"
            >
              {editing ? "Save changes" : "Save sleep"}
            </button>
          </div>
        </form>
      </div>
    ) : null;

  if (!night) {
    return (
      <>
        <EmptyState
          message="Log last night's sleep from your wearable."
          actionLabel={interactive ? "Log sleep" : undefined}
          onAction={interactive ? startCreate : undefined}
        />
        {mounted && modal ? createPortal(modal, document.body) : null}
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Last night
        </p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--ink)]">
          {format(new Date(night.started_at), "h:mm a")}
          <span className="mx-1.5 text-[var(--muted)]">→</span>
          {format(new Date(night.ended_at), "h:mm a")}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Duration</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {formatDurationMinutes(night.duration_minutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Score</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {night.score}
            <span className="text-xs font-normal text-[var(--muted)]">
              /100
            </span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[var(--muted)]">Rating</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {ratingLabel(night.rating)}
          </dd>
        </div>
      </dl>

      {interactive ? (
        <div className="mt-auto flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-medium text-[var(--accent)]"
          >
            Edit
          </button>
        </div>
      ) : null}

      {mounted && modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
