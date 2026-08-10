"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeStreak, lastNDays } from "@/lib/utils/habits";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export function HabitsPanel({ userId }: { userId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const days = lastNDays(7);
  const today = format(new Date(), "yyyy-MM-dd");

  const habits = useQuery({
    queryKey: ["habits", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const logs = useQuery({
    queryKey: ["habit_logs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", days[0]);
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      habitId,
      completed,
    }: {
      habitId: string;
      completed: boolean;
    }) => {
      if (completed) {
        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("habit_id", habitId)
          .eq("log_date", today);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_logs").upsert({
          user_id: userId,
          habit_id: habitId,
          log_date: today,
          completed: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["habit_logs", userId] }),
    onError: (err: Error) => showToast(err.message),
  });

  const add = useMutation({
    mutationFn: async (habitName: string) => {
      const { error } = await supabase.from("habits").insert({
        user_id: userId,
        name: habitName,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setName("");
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: ["habits", userId] });
    },
  });

  if (habits.isLoading || logs.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const items = habits.data ?? [];
  if (items.length === 0 && !adding) {
    return (
      <EmptyState
        message="Track a daily habit to build streaks."
        actionLabel="Add habit"
        onAction={() => setAdding(true)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {items.map((habit) => {
        const habitDates = (logs.data ?? [])
          .filter((l) => l.habit_id === habit.id && l.completed)
          .map((l) => l.log_date);
        const streak = computeStreak(habitDates);
        const doneToday = habitDates.includes(today);

        return (
          <div key={habit.id}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{habit.name}</p>
              <p className="text-xs text-[var(--muted)]">{streak} day streak</p>
            </div>
            <div className="flex gap-1.5">
              {days.map((day) => {
                const done = habitDates.includes(day);
                const isToday = day === today;
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!isToday}
                    onClick={() =>
                      isToday &&
                      toggle.mutate({ habitId: habit.id, completed: doneToday })
                    }
                    className={`h-8 flex-1 rounded-full text-[10px] font-medium ${
                      done
                        ? "bg-[var(--ink)] text-[var(--canvas)]"
                        : "bg-[var(--surface-soft)] text-[var(--muted)]"
                    } ${isToday ? "ring-2 ring-[var(--accent)] ring-offset-1" : ""}`}
                    title={day}
                  >
                    {day.slice(8)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate(name.trim());
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Habit name"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-medium text-[var(--canvas)]"
          >
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-[var(--accent)]"
        >
          + Add habit
        </button>
      )}
    </div>
  );
}
