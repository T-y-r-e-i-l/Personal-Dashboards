"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, subDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PanelConfig } from "@/lib/panels/types";
import {
  buildContributionWeeks,
  computeStreak,
  contributionLevel,
  habitRangeDayCount,
  habitRangeLabel,
  habitRangeWeekCount,
  lastNDays,
  normalizeHabitDateRange,
  type HabitDateRange,
} from "@/lib/utils/habits";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

const LEVEL_CLASS = [
  "bg-[var(--surface-soft)]",
  "bg-[var(--accent-soft)]",
  "bg-[#8fbaa6]",
  "bg-[var(--accent)]",
  "bg-[#24493c]",
] as const;

const RANGE_OPTIONS: { value: HabitDateRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

type HabitFilter = "all" | string;

function cellSizeForRange(range: HabitDateRange): number {
  switch (range) {
    case "7d":
      return 18;
    case "30d":
      return 14;
    case "6m":
      return 11;
    case "1y":
      return 10;
  }
}

export function HabitsPanel({
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
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<HabitFilter>("all");
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const [range, setRange] = useState<HabitDateRange>(() =>
    normalizeHabitDateRange(config?.dateRange),
  );

  useEffect(() => {
    setRange(normalizeHabitDateRange(config?.dateRange));
  }, [config?.dateRange]);

  const day = date ?? format(new Date(), "yyyy-MM-dd");
  const activeDay = focusedDay ?? day;
  const dayDate = useMemo(() => parseISO(`${day}T12:00:00`), [day]);
  const weekCount = habitRangeWeekCount(range);
  const dayCount = habitRangeDayCount(range);
  const activeStart = useMemo(
    () => subDays(dayDate, dayCount - 1),
    [dayDate, dayCount],
  );
  const weeks = useMemo(
    () => buildContributionWeeks(dayDate, weekCount, activeStart),
    [dayDate, weekCount, activeStart],
  );
  const rangeStart = format(activeStart, "yyyy-MM-dd");
  const cellPx = cellSizeForRange(range);
  const rangeCopy = habitRangeLabel(range);
  const sevenDayDates = useMemo(() => lastNDays(7, dayDate), [dayDate]);

  useEffect(() => {
    if (focusedDay && focusedDay < rangeStart) setFocusedDay(null);
  }, [focusedDay, rangeStart]);

  const habits = useQuery({
    queryKey: ["habits", userId],
    queryFn: async () => {
      const ordered = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!ordered.error) return ordered.data;

      if (!/column|schema cache/i.test(ordered.error.message)) {
        throw ordered.error;
      }
      const fallback = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (fallback.error) throw fallback.error;
      return fallback.data;
    },
  });

  useEffect(() => {
    if (selected === "all") return;
    const exists = (habits.data ?? []).some((habit) => habit.id === selected);
    if (!exists) setSelected("all");
  }, [habits.data, selected]);

  const logs = useQuery({
    queryKey: ["habit_logs", userId, rangeStart, day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", rangeStart)
        .lte("log_date", day);
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      habitId,
      logDate,
      completed,
    }: {
      habitId: string;
      logDate: string;
      completed: boolean;
    }) => {
      if (completed) {
        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("user_id", userId)
          .eq("habit_id", habitId)
          .eq("log_date", logDate);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_logs").upsert(
          {
            user_id: userId,
            habit_id: habitId,
            log_date: logDate,
            completed: true,
          },
          { onConflict: "habit_id,log_date" },
        );
        if (error) throw error;
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["habit_logs", userId] }),
    onError: (err: Error) => showToast(err.message),
  });

  const add = useMutation({
    mutationFn: async (habitName: string) => {
      const existing = habits.data ?? [];
      const nextOrder =
        existing.reduce(
          (max, habit) =>
            Math.max(
              max,
              typeof habit.sort_order === "number" ? habit.sort_order : 0,
            ),
          0,
        ) + 1;
      const withOrder = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          name: habitName,
          sort_order: nextOrder,
        })
        .select("id")
        .single();
      if (!withOrder.error) return withOrder.data;

      if (!/column|schema cache/i.test(withOrder.error.message)) {
        throw withOrder.error;
      }
      const basic = await supabase
        .from("habits")
        .insert({
          user_id: userId,
          name: habitName,
        })
        .select("id")
        .single();
      if (basic.error) throw basic.error;
      return basic.data;
    },
    onSuccess: async (data) => {
      setName("");
      setAdding(false);
      if (data?.id) setSelected(data.id);
      await queryClient.invalidateQueries({ queryKey: ["habits", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const items = habits.data ?? [];
  const logRows = logs.data ?? [];

  const completedByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const log of logRows) {
      if (!log.completed) continue;
      const set = map.get(log.log_date) ?? new Set<string>();
      set.add(log.habit_id);
      map.set(log.log_date, set);
    }
    return map;
  }, [logRows]);

  const selectedHabitDates = useMemo(() => {
    if (selected === "all") return new Set<string>();
    const set = new Set<string>();
    for (const [dateKey, habitIds] of completedByDate) {
      if (habitIds.has(selected)) set.add(dateKey);
    }
    return set;
  }, [completedByDate, selected]);

  const totalCompletions = useMemo(() => {
    if (selected === "all") {
      let count = 0;
      for (const habitIds of completedByDate.values()) count += habitIds.size;
      return count;
    }
    return selectedHabitDates.size;
  }, [completedByDate, selected, selectedHabitDates]);

  const streak = useMemo(() => {
    if (selected === "all") {
      const dates = [...completedByDate.entries()]
        .filter(([, ids]) => ids.size > 0)
        .map(([d]) => d);
      return computeStreak(dates, dayDate);
    }
    return computeStreak([...selectedHabitDates], dayDate);
  }, [completedByDate, dayDate, selected, selectedHabitDates]);

  if (habits.isLoading || logs.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (habits.isError || logs.isError) {
    return (
      <EmptyState
        message={
          habits.error?.message ??
          logs.error?.message ??
          "Could not load habits."
        }
      />
    );
  }

  if (items.length === 0 && !adding) {
    return (
      <EmptyState
        message="Track a daily habit — your year will fill in like a contribution graph."
        actionLabel={readOnly ? undefined : "Add habit"}
        onAction={readOnly ? undefined : () => setAdding(true)}
      />
    );
  }

  const habitCount = Math.max(items.length, 1);
  const canEditCells = !readOnly && selected !== "all";

  function levelForDate(dateKey: string): 0 | 1 | 2 | 3 | 4 {
    const done = completedByDate.get(dateKey);
    if (selected === "all") {
      return contributionLevel(done?.size ?? 0, habitCount);
    }
    return done?.has(selected) ? 4 : 0;
  }

  function onCellClick(dateKey: string, inRange: boolean) {
    if (!inRange) return;
    setFocusedDay(dateKey);
    if (!canEditCells || selected === "all") return;
    const done = completedByDate.get(dateKey)?.has(selected) ?? false;
    toggle.mutate({
      habitId: selected,
      logDate: dateKey,
      completed: done,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--ink)]">
            {totalCompletions.toLocaleString()}{" "}
            {selected === "all" ? "completions" : "days"} in the {rangeCopy}
          </p>
          <p className="text-xs text-[var(--muted)]">{streak} day streak</p>
        </div>
        <div
          className="flex shrink-0 rounded-full bg-[var(--surface-soft)] p-0.5"
          role="group"
          aria-label="Habit history range"
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

      <div className="min-w-0 flex-1">
        {range === "7d" ? (
          <div className="grid grid-cols-7 gap-2">
            {sevenDayDates.map((dateKey) => {
              const level = levelForDate(dateKey);
              const isFocused = dateKey === activeDay;
              const isToday = dateKey === day;
              const cellDate = parseISO(`${dateKey}T12:00:00`);
              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={toggle.isPending}
                  onMouseEnter={() => setFocusedDay(dateKey)}
                  onFocus={() => setFocusedDay(dateKey)}
                  onClick={() => onCellClick(dateKey, true)}
                  aria-current={isFocused ? "date" : undefined}
                  aria-label={`${format(cellDate, "EEEE, MMMM d")}${level > 0 ? ", completed" : ", incomplete"}`}
                  className={`flex aspect-square w-full flex-col items-center justify-center rounded-2xl transition ${
                    LEVEL_CLASS[level]
                  } ${
                    isFocused
                      ? "ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]"
                      : isToday
                        ? "ring-1 ring-[var(--muted)] ring-offset-1 ring-offset-[var(--surface)]"
                        : ""
                  } ${
                    level >= 3
                      ? "text-[var(--canvas)]"
                      : "text-[var(--ink)]"
                  } hover:brightness-95`}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                    {format(cellDate, "EEE")}
                  </span>
                  <span className="text-lg font-semibold leading-none">
                    {format(cellDate, "d")}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div className="inline-block min-w-full">
              <div
                className="mb-1 grid gap-[3px]"
                style={{
                  gridTemplateColumns: `28px repeat(${weeks.length}, ${cellPx}px)`,
                }}
              >
                <div />
                {weeks.map((week, i) => (
                  <div
                    key={`m-${i}`}
                    className="h-3 text-[9px] leading-none text-[var(--muted)]"
                  >
                    {week.monthLabel ?? ""}
                  </div>
                ))}
              </div>

              <div className="flex gap-[3px]">
                <div className="flex w-7 flex-col gap-[3px] pt-0">
                  {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                    <div
                      key={`d-${i}`}
                      className="flex items-center justify-end pr-1 text-[9px] leading-none text-[var(--muted)]"
                      style={{ height: cellPx }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                <div className="flex gap-[3px]">
                  {weeks.map((week, wi) => (
                    <div key={`w-${wi}`} className="flex flex-col gap-[3px]">
                      {week.days.map((cell) => {
                        const level = cell.inRange
                          ? levelForDate(cell.date)
                          : 0;
                        const isFocused = cell.date === activeDay;
                        const isToday = cell.date === day;
                        const interactive = cell.inRange;
                        return (
                          <button
                            key={cell.date}
                            type="button"
                            disabled={!interactive || toggle.isPending}
                            onMouseEnter={() => {
                              if (cell.inRange) setFocusedDay(cell.date);
                            }}
                            onFocus={() => {
                              if (cell.inRange) setFocusedDay(cell.date);
                            }}
                            onClick={() =>
                              onCellClick(cell.date, cell.inRange)
                            }
                            aria-current={isFocused ? "date" : undefined}
                            aria-label={
                              cell.inRange
                                ? `${format(parseISO(`${cell.date}T12:00:00`), "EEEE, MMMM d")}${level > 0 ? ", completed" : ", incomplete"}`
                                : undefined
                            }
                            style={{ width: cellPx, height: cellPx }}
                            className={`rounded-[2px] transition ${
                              cell.inRange
                                ? LEVEL_CLASS[level]
                                : "bg-transparent"
                            } ${
                              isFocused
                                ? "z-10 scale-125 ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--surface)]"
                                : isToday
                                  ? "ring-1 ring-[var(--muted)] ring-offset-1 ring-offset-[var(--surface)]"
                                  : ""
                            } ${
                              interactive
                                ? "cursor-pointer hover:brightness-95"
                                : "cursor-default"
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
          <p>
            {canEditCells
              ? "Click a day to toggle"
              : selected === "all"
                ? "Select a habit to edit days"
                : null}
          </p>
          <div className="flex items-center gap-1">
            <span>Less</span>
            {LEVEL_CLASS.map((cls, i) => (
              <span
                key={cls}
                className={`h-[11px] w-[11px] rounded-[2px] ${cls}`}
                aria-label={`Level ${i}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {items.length > 0 ? (
          <>
            <FilterChip
              active={selected === "all"}
              onClick={() => setSelected("all")}
              label="All"
            />
            {items.map((habit) => (
              <FilterChip
                key={habit.id}
                active={selected === habit.id}
                onClick={() => setSelected(habit.id)}
                label={habit.name}
              />
            ))}
          </>
        ) : null}

        {!readOnly && adding ? (
          <form
            className="flex min-w-[180px] flex-1 gap-2"
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
              className="min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--canvas)] px-3 py-1.5 text-xs outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)]"
            >
              Add
            </button>
          </form>
        ) : !readOnly ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
          >
            + Add habit
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-[140px] truncate rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "bg-[var(--ink)] text-[var(--canvas)]"
          : "bg-[var(--surface-soft)] text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}
