"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { getDayRangeForDate } from "@/lib/blog/dayRange";
import type { PanelConfig } from "@/lib/panels/types";
import {
  TIME_ENTRIES_KEY,
  TIME_RUNNING_KEY,
  deleteTimeEntry,
  elapsedMs,
  fetchRunningEntry,
  formatDuration,
  startTimer,
  stopRunningEntry,
  todayBoundsLocal,
  type TimeEntryRow,
} from "@/lib/time/entries";
import {
  completeToastMessage,
  isPomodoroComplete,
  modeLabel,
  plannedSecondsForMode,
  remainingMs,
  resolvePomodoroConfig,
  type TimerMode,
} from "@/lib/time/pomodoro";
import { playUiSound } from "@/lib/sounds/play";

type PomodoroMode = Exclude<TimerMode, "stopwatch">;

function isSchemaMigrationError(message: string): boolean {
  return /schema cache|timer_mode|planned_seconds/i.test(message);
}

function requestNotificationPermissionOnce() {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    void Notification.requestPermission();
  }
}

export function TimeTrackingPanel({
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
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const autoCompletedId = useRef<string | null>(null);
  const pomodoro = resolvePomodoroConfig(config);

  const dayBounds = useMemo(() => {
    if (date && timeZone) {
      const { startUtc, endUtc } = getDayRangeForDate(timeZone, date);
      return { startIso: startUtc, endIso: endUtc };
    }
    return todayBoundsLocal();
  }, [date, timeZone]);

  const interactive = !readOnly;

  const running = useQuery({
    queryKey: [TIME_RUNNING_KEY, userId],
    queryFn: () => fetchRunningEntry(supabase, userId),
    refetchInterval: 30_000,
    enabled: interactive && !date,
  });

  const entries = useQuery({
    queryKey: [TIME_ENTRIES_KEY, userId, date ?? "today"],
    queryFn: async () => {
      const { startIso, endIso } = dayBounds;
      const { data, error } = await supabase
        .from("time_entries")
        .select("*, tasks(title)")
        .eq("user_id", userId)
        .gte("started_at", startIso)
        .lt("started_at", endIso)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TimeEntryRow[];
    },
  });

  const openTasks = useQuery({
    queryKey: ["tasks", userId, "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status")
        .eq("user_id", userId)
        .eq("status", "todo")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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

  const start = useMutation({
    mutationFn: async (opts?: {
      timerMode?: TimerMode;
      plannedSeconds?: number | null;
    }) => {
      const timerMode = opts?.timerMode ?? "stopwatch";
      const selected = openTasks.data?.find((t) => t.id === taskId);

      if (timerMode === "short_break" || timerMode === "long_break") {
        return startTimer(supabase, {
          userId,
          taskId: null,
          description: modeLabel(timerMode),
          timerMode,
          plannedSeconds: opts?.plannedSeconds ?? null,
        });
      }

      if (timerMode === "focus") {
        const desc = description.trim() || selected?.title || "Focus";
        return startTimer(supabase, {
          userId,
          taskId: taskId || null,
          description: desc,
          timerMode,
          plannedSeconds: opts?.plannedSeconds ?? null,
        });
      }

      const desc =
        description.trim() || selected?.title || "Focus session";
      return startTimer(supabase, {
        userId,
        taskId: taskId || null,
        description: desc,
        timerMode: "stopwatch",
        plannedSeconds: null,
      });
    },
    onSuccess: async () => {
      playUiSound("timer_start");
      setDescription("");
      await invalidateTime();
    },
    onError: (err: Error) => {
      if (isSchemaMigrationError(err.message)) {
        showToast("Run the time_entries Pomodoro migration in Supabase.", {
          variant: "error",
        });
        return;
      }
      showToast(err.message, { variant: "error" });
    },
  });

  const stop = useMutation({
    mutationFn: () => stopRunningEntry(supabase, userId),
    onSuccess: async () => {
      playUiSound("timer_end");
      await invalidateTime();
    },
    onError: (err: Error) => showToast(err.message, { variant: "error" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTimeEntry(supabase, userId, id),
    onSuccess: async () => {
      await invalidateTime();
    },
    onError: (err: Error) => showToast(err.message),
  });

  function onStart(e: FormEvent) {
    e.preventDefault();
    start.mutate({ timerMode: "stopwatch" });
  }

  function startPomodoro(mode: PomodoroMode) {
    requestNotificationPermissionOnce();
    start.mutate({
      timerMode: mode,
      plannedSeconds: plannedSecondsForMode(mode, pomodoro),
    });
  }

  const active = interactive && !date ? running.data : null;
  const finished = (entries.data ?? []).filter((row) => row.ended_at);
  const loading =
    (interactive && !date && running.isLoading) || entries.isLoading;

  useEffect(() => {
    if (!interactive || !active?.planned_seconds || !active.started_at) return;
    if (!isPomodoroComplete(active.started_at, active.planned_seconds, now)) {
      return;
    }
    if (autoCompletedId.current === active.id) return;
    if (stop.isPending) return;
    const mode = (active.timer_mode ?? "focus") as TimerMode;
    const toastText = completeToastMessage(mode);
    const notifyBody = active.description || modeLabel(mode);
    stop.mutate(undefined, {
      onSuccess: () => {
        autoCompletedId.current = active.id;
        showToast(toastText);
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(toastText, { body: notifyBody });
        } else if (
          typeof Notification !== "undefined" &&
          Notification.permission === "default"
        ) {
          void Notification.requestPermission();
        }
      },
    });
  }, [active, interactive, now, showToast, stop]);

  const modeButtons = interactive ? (
    <PomodoroModeButtons
      pomodoro={pomodoro}
      disabled={start.isPending || stop.isPending}
      onStart={startPomodoro}
    />
  ) : null;

  const startForm = interactive ? (
    <StartForm
      description={description}
      setDescription={setDescription}
      taskId={taskId}
      setTaskId={setTaskId}
      tasks={openTasks.data ?? []}
      pending={start.isPending}
      onSubmit={onStart}
      switchMode={Boolean(active)}
    />
  ) : null;

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!active && finished.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState
          message={
            readOnly
              ? "No time tracked for this day."
              : "Start a timer or link one to a to-do."
          }
        />
        {modeButtons}
        {startForm}
      </div>
    );
  }

  const activeTitle =
    active?.tasks?.title ||
    active?.description ||
    (active ? modeLabel(active.timer_mode ?? "stopwatch") : "Timer");

  const activeDurationMs =
    active?.planned_seconds != null && active.started_at
      ? remainingMs(active.started_at, active.planned_seconds, now)
      : active
        ? elapsedMs(active.started_at, null, now)
        : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      {active ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)]/70 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--ink)]">
                {activeTitle}
              </p>
              {active.tasks?.title &&
              active.description &&
              active.description !== active.tasks.title ? (
                <p className="truncate text-xs text-[var(--muted)]">
                  {active.description}
                </p>
              ) : null}
              <p className="mt-1 font-mono text-lg tabular-nums tracking-tight">
                {formatDuration(activeDurationMs)}
              </p>
            </div>
            {interactive ? (
              <button
                type="button"
                onClick={() =>
                  stop.mutate(undefined, {
                    onSuccess: () => showToast("Timer stopped"),
                  })
                }
                disabled={stop.isPending}
                className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)] disabled:opacity-50"
              >
                {stop.isPending ? "…" : "Stop"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {modeButtons}
      {startForm}

      {finished.length > 0 ? (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {finished.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-2 border-b border-[var(--border)]/60 pb-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--ink)]">
                  {entry.tasks?.title ||
                    entry.description ||
                    modeLabel(entry.timer_mode ?? "stopwatch")}
                </p>
                {entry.tasks?.title &&
                entry.description &&
                entry.description !== entry.tasks.title ? (
                  <p className="truncate text-xs text-[var(--muted)]">
                    {entry.description}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
                  {formatDuration(
                    elapsedMs(entry.started_at, entry.ended_at),
                  )}
                </span>
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => remove.mutate(entry.id)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                    aria-label="Delete entry"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PomodoroModeButtons({
  pomodoro,
  disabled,
  onStart,
}: {
  pomodoro: ReturnType<typeof resolvePomodoroConfig>;
  disabled: boolean;
  onStart: (mode: PomodoroMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(
        [
          ["focus", "Focus", pomodoro.focusMin],
          ["short_break", "Short break", pomodoro.shortBreakMin],
          ["long_break", "Long break", pomodoro.longBreakMin],
        ] as const
      ).map(([mode, label, minutes]) => (
        <button
          key={mode}
          type="button"
          disabled={disabled}
          onClick={() => onStart(mode)}
          className="rounded-xl border border-[var(--border)] px-2 py-2 text-center transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
        >
          <span className="block text-xs font-medium text-[var(--ink)]">
            {label}
          </span>
          <span className="block text-[11px] text-[var(--muted)]">
            {minutes}m
          </span>
        </button>
      ))}
    </div>
  );
}

function StartForm({
  description,
  setDescription,
  taskId,
  setTaskId,
  tasks,
  pending,
  onSubmit,
  switchMode = false,
}: {
  description: string;
  setDescription: (v: string) => void;
  taskId: string;
  setTaskId: (v: string) => void;
  tasks: { id: string; title: string }[];
  pending: boolean;
  onSubmit: (e: FormEvent) => void;
  switchMode?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What are you working on?"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
      />
      <div className="flex gap-2">
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-2 py-2 text-xs outline-none"
        >
          <option value="">No linked to-do</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-[var(--ink)] px-3 py-2 text-xs font-medium text-[var(--canvas)] disabled:opacity-50"
        >
          {pending ? "…" : switchMode ? "Switch" : "Start"}
        </button>
      </div>
    </form>
  );
}
