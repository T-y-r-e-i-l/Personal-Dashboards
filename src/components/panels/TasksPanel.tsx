"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getDayRangeForDate } from "@/lib/blog/dayRange";
import {
  TIME_ENTRIES_KEY,
  TIME_RUNNING_KEY,
  elapsedMs,
  fetchRunningEntry,
  formatDuration,
  startTimer,
  stopRunningEntry,
} from "@/lib/time/entries";

export function TasksPanel({
  userId,
  date,
  readOnly = false,
  timeZone,
}: {
  userId: string;
  date?: string;
  readOnly?: boolean;
  timeZone?: string;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const interactive = !readOnly;
  const historical = Boolean(readOnly && date && timeZone);
  const historicalUnavailable = Boolean(readOnly && date && !timeZone);

  const tasks = useQuery({
    queryKey: historical
      ? ["tasks", userId, "completed", date, timeZone]
      : ["tasks", userId],
    queryFn: async () => {
      if (historical && date && timeZone) {
        const { startUtc, endUtc } = getDayRangeForDate(timeZone, date);
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "done")
          .gte("updated_at", startUtc)
          .lt("updated_at", endUtc)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !historicalUnavailable,
  });

  const running = useQuery({
    queryKey: [TIME_RUNNING_KEY, userId],
    queryFn: () => fetchRunningEntry(supabase, userId),
    refetchInterval: 30_000,
    enabled: interactive,
  });

  useEffect(() => {
    if (!running.data) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running.data]);

  async function invalidateTime() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [TIME_RUNNING_KEY, userId] }),
      queryClient.invalidateQueries({ queryKey: [TIME_ENTRIES_KEY, userId] }),
    ]);
  }

  const toggle = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "todo" | "done";
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: status === "done" ? "todo" : "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", userId] }),
  });

  const add = useMutation({
    mutationFn: async (taskTitle: string) => {
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: taskTitle,
        due_date: format(new Date(), "yyyy-MM-dd"),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const timer = useMutation({
    mutationFn: async ({
      taskId,
      taskTitle,
      action,
    }: {
      taskId: string;
      taskTitle: string;
      action: "start" | "stop";
    }) => {
      if (action === "stop") {
        return stopRunningEntry(supabase, userId);
      }
      return startTimer(supabase, {
        userId,
        taskId,
        description: taskTitle,
      });
    },
    onSuccess: async () => {
      await invalidateTime();
    },
    onError: (err: Error) => showToast(err.message),
  });

  if (historicalUnavailable) {
    return (
      <EmptyState message="Completed tasks unavailable for this day." />
    );
  }

  if (tasks.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const items = tasks.data ?? [];
  if (items.length === 0 && !(adding && interactive)) {
    return (
      <EmptyState
        message={
          historical
            ? "No completed tasks for this day."
            : "No tasks yet. Add your first one."
        }
        actionLabel={interactive ? "Add task" : undefined}
        onAction={interactive ? () => setAdding(true) : undefined}
      />
    );
  }

  const activeTaskId = running.data?.task_id ?? null;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((task) => {
          const isRunning = interactive && activeTaskId === task.id;
          return (
            <li
              key={task.id}
              className={`flex items-start gap-2 rounded-xl px-1 py-0.5 ${
                isRunning ? "bg-[var(--surface-soft)]" : ""
              }`}
            >
              {readOnly ? (
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    task.status === "done"
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)]"
                  }`}
                >
                  {task.status === "done" ? "✓" : ""}
                </span>
              ) : (
                <button
                  type="button"
                  aria-label={
                    task.status === "done" ? "Mark incomplete" : "Complete"
                  }
                  onClick={() =>
                    toggle.mutate({ id: task.id, status: task.status })
                  }
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    task.status === "done"
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)]"
                  }`}
                >
                  {task.status === "done" ? "✓" : ""}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    task.status === "done"
                      ? "text-[var(--muted)] line-through"
                      : "text-[var(--ink)]"
                  }`}
                >
                  {task.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  {task.due_date ? (
                    <span>
                      {format(new Date(task.due_date), "MMM d")} ·{" "}
                      {task.priority}
                    </span>
                  ) : null}
                  {isRunning && running.data ? (
                    <span className="font-mono tabular-nums text-[var(--accent)]">
                      {formatDuration(
                        elapsedMs(running.data.started_at, null, now),
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
              {interactive && task.status !== "done" ? (
                <button
                  type="button"
                  aria-label={isRunning ? "Stop timer" : "Start timer"}
                  title={isRunning ? "Stop timer" : "Start timer"}
                  disabled={timer.isPending}
                  onClick={() =>
                    timer.mutate({
                      taskId: task.id,
                      taskTitle: task.title,
                      action: isRunning ? "stop" : "start",
                    })
                  }
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-50 ${
                    isRunning
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {isRunning ? <StopIcon /> : <PlayIcon />}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {interactive && adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate(title.trim());
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-medium text-[var(--canvas)]"
          >
            Add
          </button>
        </form>
      ) : interactive ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-[var(--accent)]"
        >
          + Add task
        </button>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
