"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import type { PanelConfig } from "@/lib/panels/types";
import { averageMood } from "@/lib/utils/habits";
import {
  aggregateMoodByDay,
  combineDateAndTime,
  latestMoodLog,
  moodLogStreak,
  moodRangeLabel,
  moodRangeStartDate,
  normalizeMoodDateRange,
  type MoodDateRange,
  type MoodLogLike,
} from "@/lib/utils/mood";
import {
  formatMoodActivity,
  logActivity,
} from "@/lib/activity/logActivity";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const RANGE_OPTIONS: { value: MoodDateRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

type Draft = {
  mood: number;
  energy: number;
  stress: number;
  note: string;
  time: string;
};

function emptyDraft(time?: string): Draft {
  return {
    mood: 7,
    energy: 7,
    stress: 5,
    note: "",
    time: time ?? format(new Date(), "HH:mm"),
  };
}

export function MoodPanel({
  userId,
  date,
  readOnly = false,
  config,
}: {
  userId: string;
  date?: string;
  readOnly?: boolean;
  config?: PanelConfig;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [range, setRange] = useState<MoodDateRange>(() =>
    normalizeMoodDateRange(config?.dateRange),
  );
  const [logging, setLogging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setRange(normalizeMoodDateRange(config?.dateRange));
  }, [config?.dateRange]);

  useEffect(() => {
    if (!logging) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLogging(false);
        setEditingId(null);
        setDraft(emptyDraft());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [logging]);

  const day = date ?? format(new Date(), "yyyy-MM-dd");
  const activeDay = focusedDay ?? day;
  const rangeStart = moodRangeStartDate(day, range);

  const logs = useQuery({
    queryKey: ["mood_logs", userId, rangeStart, day],
    queryFn: async () => {
      const withTime = await supabase
        .from("mood_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", rangeStart)
        .lte("log_date", day)
        .order("logged_at", { ascending: true });
      if (!withTime.error) return withTime.data as MoodLogLike[];

      if (!/column|schema cache|logged_at/i.test(withTime.error.message)) {
        throw withTime.error;
      }

      const fallback = await supabase
        .from("mood_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", rangeStart)
        .lte("log_date", day)
        .order("log_date", { ascending: true });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []) as MoodLogLike[];
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mood_logs", userId] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const loggedAt = combineDateAndTime(activeDay, draft.time);
      const note = draft.note.trim();
      const payload = {
        user_id: userId,
        log_date: activeDay,
        logged_at: loggedAt,
        mood: draft.mood,
        energy: draft.energy,
        stress: draft.stress,
        note: note || null,
      };
      const isEdit = Boolean(editingId);

      if (editingId) {
        const { error } = await supabase
          .from("mood_logs")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId);
        if (error) throw error;
        return { isEdit };
      }

      const withTime = await supabase.from("mood_logs").insert(payload);
      if (withTime.error) {
        if (!/column|schema cache|logged_at/i.test(withTime.error.message)) {
          throw withTime.error;
        }

        // Pre-migration fallback: one row per day via upsert without logged_at.
        const { error } = await supabase.from("mood_logs").upsert(
          {
            user_id: userId,
            log_date: activeDay,
            mood: draft.mood,
            energy: draft.energy,
            stress: draft.stress,
            note: note || null,
          },
          { onConflict: "user_id,log_date" },
        );
        if (error) throw error;
      }

      await logActivity(supabase, {
        userId,
        kind: "mood",
        at: loggedAt,
        content: formatMoodActivity({
          mood: draft.mood,
          energy: draft.energy,
          stress: draft.stress,
          note,
        }),
      });

      return { isEdit };
    },
    onSuccess: async (result) => {
      setLogging(false);
      setEditingId(null);
      setDraft(emptyDraft());
      showToast(result.isEdit ? "Check-in updated" : "Check-in logged");
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ["captures", userId] }),
      ]);
    },
    onError: (err: Error) => showToast(err.message),
  });

  const data = logs.data ?? [];
  const chartData = useMemo(() => aggregateMoodByDay(data), [data]);
  const latest = latestMoodLog(data, activeDay);
  const periodMoodAvg = averageMood(
    chartData.map((d) => d.mood).filter((v): v is number => v != null),
  );
  const streak = moodLogStreak(data, day);
  const rangeCopy = moodRangeLabel(range);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setLogging(true);
  }

  function cancelForm() {
    setLogging(false);
    setEditingId(null);
    setDraft(emptyDraft());
  }

  if (logs.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (logs.isError) {
    return (
      <EmptyState message={logs.error.message || "Could not load mood logs."} />
    );
  }

  if (data.length === 0 && !logging) {
    return (
      <EmptyState
        message="Log mood, energy, and stress through the day to see trends."
        actionLabel={readOnly ? undefined : "Log check-in"}
        onAction={readOnly ? undefined : startCreate}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <Metric label="Mood" value={latest?.mood} />
            <Metric label="Energy" value={latest?.energy} />
            <Metric label="Stress" value={latest?.stress} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Avg mood {periodMoodAvg ?? "—"} · {streak} day streak · {rangeCopy}
          </p>
        </div>
        <div
          className="flex shrink-0 rounded-full bg-[var(--surface-soft)] p-0.5"
          role="group"
          aria-label="Mood history range"
        >
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition ${
                range === option.value
                  ? "bg-[var(--ink)] text-[var(--canvas)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[110px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="log_date"
              tickFormatter={(v) =>
                format(parseISO(`${v}T12:00:00`), range === "7d" ? "EEE" : "M/d")
              }
              tick={{ fontSize: 10, fill: "#6b6b66" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={[1, 10]} hide />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e4e1d8",
                fontSize: 12,
              }}
              labelFormatter={(v) =>
                format(parseISO(`${String(v)}T12:00:00`), "EEE, MMM d")
              }
            />
            <Line
              type="monotone"
              dataKey="mood"
              name="Mood"
              stroke="#3d6b5a"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#3d6b5a" }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="energy"
              name="Energy"
              stroke="#c4a35a"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#c4a35a" }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="stress"
              name="Stress"
              stroke="#b42318"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#b42318" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-[var(--muted)]">
          <LegendSwatch color="#3d6b5a" label="Mood" />
          <LegendSwatch color="#c4a35a" label="Energy" />
          <LegendSwatch color="#b42318" label="Stress" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        {!readOnly ? (
          <button
            type="button"
            onClick={startCreate}
            className="text-xs font-medium text-[var(--accent)]"
          >
            + Log check-in
          </button>
        ) : (
          <span />
        )}
        {chartData.length > 1 ? (
          <div className="flex flex-wrap justify-end gap-1">
            {chartData.map((point) => (
              <button
                key={point.log_date}
                type="button"
                onClick={() => setFocusedDay(point.log_date)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  point.log_date === activeDay
                    ? "bg-[var(--ink)] text-[var(--canvas)]"
                    : "bg-[var(--surface-soft)] text-[var(--muted)]"
                }`}
              >
                {format(parseISO(`${point.log_date}T12:00:00`), "M/d")}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {logging && !readOnly && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
              onClick={cancelForm}
            >
              <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="mood-checkin-title"
                className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2
                      id="mood-checkin-title"
                      className="font-[family-name:var(--font-display)] text-2xl"
                    >
                      {editingId ? "Edit check-in" : "New check-in"}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {format(
                        parseISO(`${activeDay}T12:00:00`),
                        "EEEE, MMM d",
                      )}
                    </p>
                  </div>
                  <label className="flex shrink-0 flex-col items-end gap-1 text-xs text-[var(--muted)]">
                    Time
                    <input
                      type="time"
                      value={draft.time}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, time: e.target.value }))
                      }
                      className="rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-2 py-1.5 text-sm text-[var(--ink)]"
                    />
                  </label>
                </div>

                <div className="mt-6 space-y-4">
                  <SliderField
                    label="Mood"
                    value={draft.mood}
                    onChange={(mood) => setDraft((d) => ({ ...d, mood }))}
                  />
                  <SliderField
                    label="Energy"
                    value={draft.energy}
                    onChange={(energy) =>
                      setDraft((d) => ({ ...d, energy }))
                    }
                  />
                  <SliderField
                    label="Stress"
                    value={draft.stress}
                    onChange={(stress) =>
                      setDraft((d) => ({ ...d, stress }))
                    }
                  />

                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium">
                      Note (optional)
                    </span>
                    <input
                      value={draft.note}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, note: e.target.value }))
                      }
                      placeholder="What shaped this check-in?"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
                    />
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
                    {editingId ? "Save changes" : "Save check-in"}
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <p className="text-sm">
      <span className="text-[var(--muted)]">{label} </span>
      <span className="text-xl font-semibold tracking-tight">
        {value ?? "—"}
      </span>
      <span className="text-xs text-[var(--muted)]">/10</span>
    </p>
  );
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        <span className="text-xs font-semibold">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
