"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const TIERS = ["must", "should", "nice"] as const;

export function PrioritiesPanel({ userId }: { userId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const today = format(new Date(), "yyyy-MM-dd");
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("must");
  const [adding, setAdding] = useState(false);

  const items = useQuery({
    queryKey: ["daily_priorities", userId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_priorities")
        .select("*")
        .eq("user_id", userId)
        .eq("priority_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("daily_priorities")
        .update({ done: !done })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["daily_priorities", userId, today],
      }),
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("daily_priorities").insert({
        user_id: userId,
        title: title.trim(),
        tier,
        priority_date: today,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      setAdding(false);
      await queryClient.invalidateQueries({
        queryKey: ["daily_priorities", userId, today],
      });
    },
    onError: (err: Error) => showToast(err.message),
  });

  if (items.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const data = items.data ?? [];
  const doneCount = data.filter((d) => d.done).length;

  if (data.length === 0 && !adding) {
    return (
      <EmptyState
        message="Set what must get done today."
        actionLabel="Add priority"
        onAction={() => setAdding(true)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--muted)]">
        {doneCount}/{data.length} complete
      </p>
      {TIERS.map((t) => {
        const group = data.filter((d) => d.tier === t);
        if (group.length === 0) return null;
        return (
          <div key={t}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {t}
            </p>
            <ul className="space-y-2">
              {group.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggle.mutate({ id: item.id, done: item.done })
                    }
                    className={`mt-0.5 h-4 w-4 rounded border ${
                      item.done
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--border)]"
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      item.done
                        ? "text-[var(--muted)] line-through"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {item.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {adding ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Priority title"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
          />
          <div className="flex items-center gap-2">
            <select
              value={tier}
              onChange={(e) =>
                setTier(e.target.value as (typeof TIERS)[number])
              }
              className="rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-2 py-1.5 text-xs"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)]"
            >
              Add
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-[var(--accent)]"
        >
          + Add priority
        </button>
      )}
    </div>
  );
}
