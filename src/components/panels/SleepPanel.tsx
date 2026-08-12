"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { SleepLog, SleepRating } from "@/lib/database.types";
import { EmptyState } from "@/components/ui/EmptyState";

const RATINGS: { value: SleepRating; label: string }[] = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
  { value: "excellent", label: "Excellent" },
];

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
  const sleepDate = date ?? format(new Date(), "yyyy-MM-dd");

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

  if (log.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (log.isError) {
    return (
      <EmptyState message={log.error.message || "Could not load sleep log."} />
    );
  }

  const night = log.data;

  if (!night) {
    return (
      <EmptyState
        message={
          readOnly
            ? "No sleep logged for this day."
            : "Log last night's sleep from panel Settings."
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-stretch justify-center gap-3">
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
    </div>
  );
}
