"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";
import { useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { averageMood } from "@/lib/utils/habits";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export function MoodPanel({
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
  const [mood, setMood] = useState(7);
  const [logging, setLogging] = useState(false);
  const day = date ?? format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(parseISO(day), 6), "yyyy-MM-dd");

  const logs = useQuery({
    queryKey: ["mood_logs", userId, day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mood_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", weekAgo)
        .lte("log_date", day)
        .order("log_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase.from("mood_logs").upsert({
        user_id: userId,
        log_date: day,
        mood: value,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setLogging(false);
      showToast("Mood logged");
      await queryClient.invalidateQueries({
        queryKey: ["mood_logs", userId, day],
      });
    },
    onError: (err: Error) => showToast(err.message),
  });

  if (logs.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const data = logs.data ?? [];
  const avg = averageMood(data.map((d) => d.mood));
  const dayLog = data.find((d) => d.log_date === day);

  if (data.length === 0 && !logging) {
    return (
      <EmptyState
        message="Log today's mood to start seeing trends."
        actionLabel={readOnly ? undefined : "Log mood"}
        onAction={readOnly ? undefined : () => setLogging(true)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            {dayLog?.mood ?? "—"}
            <span className="text-base font-normal text-[var(--muted)]">
              /10
            </span>
          </p>
          <p className="text-xs text-[var(--muted)]">
            Week avg {avg ?? "—"}
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => setLogging((v) => !v)}
            className="text-xs font-medium text-[var(--accent)]"
          >
            {logging ? "Cancel" : "Log today"}
          </button>
        ) : null}
      </div>

      {logging && !readOnly ? (
        <div className="space-y-2">
          <input
            type="range"
            min={1}
            max={10}
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{mood}/10</span>
            <button
              type="button"
              onClick={() => save.mutate(mood)}
              className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)]"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-[120px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="log_date"
                tickFormatter={(v) => format(new Date(v), "EEE")}
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
              />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="#3d6b5a"
                strokeWidth={2}
                dot={{ r: 3, fill: "#161616" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
