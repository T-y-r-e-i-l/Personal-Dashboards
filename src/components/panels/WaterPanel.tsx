"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { waterProgress } from "@/lib/utils/habits";
import { useToast } from "@/components/ui/Toast";

export function WaterPanel({
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
  const day = date ?? format(new Date(), "yyyy-MM-dd");

  const log = useQuery({
    queryKey: ["water_logs", userId, day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", day)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (delta: number) => {
      const current = log.data;
      const glasses = Math.max(0, (current?.glasses ?? 0) + delta);
      const goal = current?.goal ?? 8;
      const { error } = await supabase.from("water_logs").upsert({
        user_id: userId,
        log_date: day,
        glasses,
        goal,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["water_logs", userId, day],
      }),
    onError: (err: Error) => showToast(err.message),
  });

  const glasses = log.data?.glasses ?? 0;
  const goal = log.data?.goal ?? 8;
  const progress = waterProgress(glasses, goal);

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        <p className="text-4xl font-semibold tracking-tight">{glasses}</p>
        <p className="text-sm text-[var(--muted)]">of {goal} glasses</p>
      </div>
      <div className="my-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      {!readOnly ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update.mutate(-1)}
            className="flex-1 rounded-full border border-[var(--border)] py-2 text-sm font-medium"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => update.mutate(1)}
            className="flex-1 rounded-full bg-[var(--ink)] py-2 text-sm font-medium text-[var(--canvas)]"
          >
            + Log glass
          </button>
        </div>
      ) : null}
    </div>
  );
}
