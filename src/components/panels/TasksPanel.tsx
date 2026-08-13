"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getDayRangeForDate } from "@/lib/blog/dayRange";
import {
  formatTodoCompletedActivity,
  logActivity,
} from "@/lib/activity/logActivity";
import {
  TIME_ENTRIES_KEY,
  TIME_RUNNING_KEY,
  elapsedMs,
  fetchRunningEntry,
  formatDuration,
  startTimer,
  stopRunningEntry,
} from "@/lib/time/entries";
import type { PanelConfig } from "@/lib/panels/types";
import { playUiSound } from "@/lib/sounds/play";

type TaskFloatPopup = {
  text: "Nice!" | "Oops!";
  key: number;
};

const HIDE_COMPLETED_GRACE_MS = 2000;

export function TasksPanel({
  userId,
  date,
  readOnly = false,
  timeZone,
  config,
}: {
  userId: string;
  date?: string;
  readOnly?: boolean;
  timeZone?: string;
  config?: PanelConfig;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [floatPopups, setFloatPopups] = useState<
    Record<string, TaskFloatPopup>
  >({});
  const [heldCompletedIds, setHeldCompletedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const hideCompletedTimers = useRef<Map<string, number>>(new Map());
  const popupKeyRef = useRef(0);

  const interactive = !readOnly;
  const historical = Boolean(readOnly && date && timeZone);
  const historicalUnavailable = Boolean(readOnly && date && !timeZone);
  const showCompleted = config?.showCompleted ?? true;

  useEffect(() => {
    const timers = hideCompletedTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  function clearHeldCompleted(taskId: string) {
    const existing = hideCompletedTimers.current.get(taskId);
    if (existing != null) {
      window.clearTimeout(existing);
      hideCompletedTimers.current.delete(taskId);
    }
    setHeldCompletedIds((prev) => {
      if (!prev.has(taskId)) return prev;
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }

  function holdCompletedBriefly(taskId: string) {
    clearHeldCompleted(taskId);
    setHeldCompletedIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
    const timer = window.setTimeout(() => {
      hideCompletedTimers.current.delete(taskId);
      setHeldCompletedIds((prev) => {
        if (!prev.has(taskId)) return prev;
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, HIDE_COMPLETED_GRACE_MS);
    hideCompletedTimers.current.set(taskId, timer);
  }

  function showTaskFloat(taskId: string, text: TaskFloatPopup["text"]) {
    popupKeyRef.current += 1;
    const key = popupKeyRef.current;
    setFloatPopups((prev) => ({ ...prev, [taskId]: { text, key } }));
  }

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

      const ordered = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!ordered.error) return ordered.data;

      // Fallback before sort_order / archived_at migrations are applied.
      if (!/column|schema cache/i.test(ordered.error.message)) {
        throw ordered.error;
      }
      const withoutArchive = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!withoutArchive.error) {
        return (withoutArchive.data ?? []).filter(
          (task) => !(task as { archived_at?: string | null }).archived_at,
        );
      }
      if (!/column|schema cache/i.test(withoutArchive.error.message)) {
        throw withoutArchive.error;
      }
      const fallback = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).filter(
        (task) => !(task as { archived_at?: string | null }).archived_at,
      );
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
      queryClient.invalidateQueries({ queryKey: ["captures", userId] }),
    ]);
  }

  const toggle = useMutation({
    mutationFn: async ({
      id,
      status,
      title,
    }: {
      id: string;
      status: "todo" | "done";
      title: string;
    }) => {
      const next = status === "done" ? "todo" : "done";
      const completedAt = new Date().toISOString();
      const { error } = await supabase
        .from("tasks")
        .update({
          status: next,
          updated_at: completedAt,
        })
        .eq("id", id);
      if (error) throw error;

      if (next === "done") {
        await logActivity(supabase, {
          userId,
          kind: "todo",
          at: completedAt,
          content: formatTodoCompletedActivity(title),
        });
      }

      return { completed: next === "done", id };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
      playUiSound(result.completed ? "todo_complete" : "todo_uncomplete");
      showTaskFloat(result.id, result.completed ? "Nice!" : "Oops!");
      if (result.completed) {
        if (!showCompleted) holdCompletedBriefly(result.id);
        await queryClient.invalidateQueries({
          queryKey: ["captures", userId],
        });
      } else {
        clearHeldCompleted(result.id);
      }
    },
  });

  const add = useMutation({
    mutationFn: async (taskTitle: string) => {
      const existing = tasks.data ?? [];
      const nextOrder =
        existing.reduce(
          (max, task) =>
            Math.max(max, typeof task.sort_order === "number" ? task.sort_order : 0),
          0,
        ) + 1;
      const withOrder = await supabase.from("tasks").insert({
        user_id: userId,
        title: taskTitle,
        due_date: format(new Date(), "yyyy-MM-dd"),
        sort_order: nextOrder,
      });
      if (!withOrder.error) return;

      if (!/column|schema cache/i.test(withOrder.error.message)) {
        throw withOrder.error;
      }
      const basic = await supabase.from("tasks").insert({
        user_id: userId,
        title: taskTitle,
        due_date: format(new Date(), "yyyy-MM-dd"),
      });
      if (basic.error) throw basic.error;
    },
    onSuccess: async () => {
      setTitle("");
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const updateTask = useMutation({
    mutationFn: async ({
      id,
      nextTitle,
      nextDueDate,
    }: {
      id: string;
      nextTitle: string;
      nextDueDate: string;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: nextTitle,
          due_date: nextDueDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditTitle("");
      setEditDueDate("");
      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
      showToast("Task updated");
    },
    onError: (err: Error) => showToast(err.message),
  });

  const archiveTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
      showToast("Task archived");
    },
    onError: (err: Error) => {
      if (/column|schema cache/i.test(err.message)) {
        showToast(
          "Run the tasks_archived_at migration in Supabase to enable archiving.",
        );
        return;
      }
      showToast(err.message);
    },
  });

  function startEdit(task: {
    id: string;
    title: string;
    due_date: string | null;
  }) {
    if (!interactive) return;
    setAdding(false);
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDueDate(task.due_date ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDueDate("");
  }

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

  const items = (tasks.data ?? []).filter(
    (task) =>
      historical ||
      showCompleted ||
      task.status !== "done" ||
      heldCompletedIds.has(task.id),
  );
  if (items.length === 0 && !(adding && interactive)) {
    return (
      <EmptyState
        message={
          historical
            ? "No completed tasks for this day."
            : (tasks.data?.length ?? 0) > 0 && !showCompleted
              ? "No open tasks. Completed ones are hidden."
              : "No tasks yet. Add your first one."
        }
        actionLabel={interactive ? "Add task" : undefined}
        onAction={
          interactive
            ? () => {
                cancelEdit();
                setAdding(true);
              }
            : undefined
        }
      />
    );
  }

  const activeTaskId = running.data?.task_id ?? null;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((task) => {
          const isRunning = interactive && activeTaskId === task.id;
          const isEditing = interactive && editingId === task.id;

          if (isEditing) {
            return (
              <li
                key={task.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--canvas)]/60 p-2"
              >
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nextTitle = editTitle.trim();
                    if (!nextTitle) return;
                    updateTask.mutate({
                      id: task.id,
                      nextTitle,
                      nextDueDate: editDueDate,
                    });
                  }}
                >
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    placeholder="Task title"
                    aria-label="Task title"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none"
                  />
                  <label className="block">
                    <span className="mb-1 block text-xs text-[var(--muted)]">
                      Due date
                    </span>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none"
                    />
                  </label>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={updateTask.isPending}
                      className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={updateTask.isPending || !editTitle.trim()}
                      className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)] disabled:opacity-50"
                    >
                      {updateTask.isPending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              </li>
            );
          }

          return (
            <li
              key={task.id}
              className={`flex items-start gap-2 rounded-xl px-1 py-0.5 transition ${
                isRunning ? "bg-[var(--surface-soft)]" : ""
              }`}
            >
              <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
                {readOnly ? (
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
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
                      toggle.mutate({
                        id: task.id,
                        status: task.status,
                        title: task.title,
                      })
                    }
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      task.status === "done"
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {task.status === "done" ? "✓" : ""}
                  </button>
                )}
                {floatPopups[task.id] ? (
                  <TaskFloatLabel
                    text={floatPopups[task.id].text}
                    animKey={floatPopups[task.id].key}
                    onDone={(animKey) => {
                      setFloatPopups((prev) => {
                        if (prev[task.id]?.key !== animKey) return prev;
                        const next = { ...prev };
                        delete next[task.id];
                        return next;
                      });
                    }}
                  />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => startEdit(task)}
                    className="w-full rounded-lg text-left outline-none transition hover:bg-[var(--surface-soft)]/70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    title="Edit task"
                  >
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
                        <span>{formatDueDate(task.due_date)}</span>
                      ) : (
                        <span>No due date</span>
                      )}
                      {isRunning && running.data ? (
                        <span className="font-mono tabular-nums text-[var(--accent)]">
                          {formatDuration(
                            elapsedMs(running.data.started_at, null, now),
                          )}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ) : (
                  <>
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
                        <span>{formatDueDate(task.due_date)}</span>
                      ) : null}
                    </div>
                  </>
                )}
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
              {interactive && task.status === "done" ? (
                <button
                  type="button"
                  aria-label="Archive task"
                  title="Archive"
                  disabled={archiveTask.isPending}
                  onClick={() => archiveTask.mutate(task.id)}
                  className="mt-0.5 shrink-0 rounded-full px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  Archive
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
          onClick={() => {
            cancelEdit();
            setAdding(true);
          }}
          className="text-xs font-medium text-[var(--accent)]"
        >
          + Add task
        </button>
      ) : null}
    </div>
  );
}

function TaskFloatLabel({
  text,
  animKey,
  onDone,
}: {
  text: TaskFloatPopup["text"];
  animKey: number;
  onDone: (animKey: number) => void;
}) {
  return (
    <span
      key={animKey}
      aria-hidden
      className="task-float-fade absolute left-1/2 top-0 z-10 whitespace-nowrap text-xs font-bold text-[var(--accent)]"
      onAnimationEnd={() => onDone(animKey)}
    >
      {text}
    </span>
  );
}

function formatDueDate(dueDate: string) {
  // due_date is YYYY-MM-DD; parse as local calendar date to avoid UTC shift.
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return dueDate;
  return format(new Date(y, m - 1, d), "MMM d");
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

