"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { SleepLog } from "@/lib/database.types";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SLEEP_WINDOW_DAYS,
  formatDurationMinutes,
  ratingLabel,
  sleepWindowDates,
  summarizeSleepLogs,
} from "@/lib/sleep/analytics";

type SleepTab = "tracked" | "analytics";

const TABS: { value: SleepTab; label: string }[] = [
  { value: "tracked", label: "Tracked" },
  { value: "analytics", label: "Analytics" },
];

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
  const windowDates = useMemo(
    () => sleepWindowDates(sleepDate, SLEEP_WINDOW_DAYS),
    [sleepDate],
  );
  const rangeStart = windowDates[0]!;
  const [tab, setTab] = useState<SleepTab>("tracked");

  const logsQuery = useQuery({
    queryKey: ["sleep_logs", userId, "range", rangeStart, sleepDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("sleep_date", rangeStart)
        .lte("sleep_date", sleepDate)
        .order("sleep_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SleepLog[];
    },
  });

  const night = useMemo(
    () => logsQuery.data?.find((log) => log.sleep_date === sleepDate) ?? null,
    [logsQuery.data, sleepDate],
  );

  const summary = useMemo(
    () => summarizeSleepLogs(logsQuery.data ?? [], sleepDate, SLEEP_WINDOW_DAYS),
    [logsQuery.data, sleepDate],
  );

  if (logsQuery.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (logsQuery.isError) {
    return (
      <EmptyState
        message={logsQuery.error.message || "Could not load sleep log."}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className="flex shrink-0 rounded-full bg-[var(--surface-soft)] p-0.5 self-start"
        role="tablist"
        aria-label="Sleep panel view"
      >
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition ${
              tab === option.value
                ? "bg-[var(--ink)] text-[var(--canvas)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === "tracked" ? (
        <TrackedView night={night} readOnly={readOnly} />
      ) : (
        <AnalyticsView summary={summary} readOnly={readOnly} />
      )}
    </div>
  );
}

function TrackedView({
  night,
  readOnly,
}: {
  night: SleepLog | null;
  readOnly: boolean;
}) {
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
    <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-3">
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

function AnalyticsView({
  summary,
  readOnly,
}: {
  summary: ReturnType<typeof summarizeSleepLogs>;
  readOnly: boolean;
}) {
  if (summary.count === 0) {
    return (
      <EmptyState
        message={
          readOnly
            ? "No sleep logged in the last 7 days."
            : "Log sleep from panel Settings to see 7-day averages."
        }
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[var(--muted)]">Avg bedtime</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {summary.avgBedtimeLabel ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Avg duration</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {summary.avgDurationMinutes == null
              ? "—"
              : formatDurationMinutes(summary.avgDurationMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Avg score</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {summary.avgScore == null ? (
              "—"
            ) : (
              <>
                {summary.avgScore}
                <span className="text-xs font-normal text-[var(--muted)]">
                  /100
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Avg rating</dt>
          <dd className="mt-0.5 text-base font-semibold">
            {summary.avgRating ? ratingLabel(summary.avgRating) : "—"}
          </dd>
        </div>
      </dl>

      <p className="shrink-0 text-xs text-[var(--muted)]">
        Based on {summary.count} of {summary.windowDays} nights
      </p>

      <div className="min-h-[110px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={summary.chartPoints}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="sleep_date"
              tickFormatter={(v) =>
                format(parseISO(`${v}T12:00:00`), "EEE")
              }
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="duration"
              domain={[0, "auto"]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v) => `${v}h`}
            />
            <YAxis
              yAxisId="score"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--muted)" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                fontSize: 12,
              }}
              labelFormatter={(v) =>
                format(parseISO(`${String(v)}T12:00:00`), "EEE, MMM d")
              }
              formatter={(value, name) => {
                if (value == null || typeof value !== "number") {
                  return ["—", String(name)];
                }
                if (name === "Duration") {
                  return [
                    formatDurationMinutes(Math.round(value * 60)),
                    "Duration",
                  ];
                }
                return [Math.round(value), "Score"];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
              iconType="circle"
              iconSize={8}
            />
            <Line
              yAxisId="duration"
              type="monotone"
              dataKey="durationHours"
              name="Duration"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "var(--accent)" }}
              connectNulls={false}
            />
            <Line
              yAxisId="score"
              type="monotone"
              dataKey="score"
              name="Score"
              stroke="var(--ink)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "var(--ink)" }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
