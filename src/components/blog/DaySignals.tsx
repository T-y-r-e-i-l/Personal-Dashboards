"use client";

import { useState } from "react";
import type { DayContext } from "@/lib/blog/types";
import type { Json } from "@/lib/database.types";

function parseDayContext(value: Json): DayContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as unknown as DayContext;
}

export function DaySignals({ dayContext }: { dayContext: Json }) {
  const [open, setOpen] = useState(false);
  const ctx = parseDayContext(dayContext);
  if (!ctx) return null;

  const hasAnything =
    ctx.completed_tasks.length > 0 ||
    ctx.priorities.length > 0 ||
    ctx.mood ||
    ctx.weather ||
    ctx.calendar.length > 0 ||
    ctx.habits.length > 0 ||
    ctx.water;

  if (!hasAnything) return null;

  return (
    <section className="mt-10 border-t border-[var(--border)] pt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-sm font-semibold tracking-tight">Day signals</h2>
        <span className="text-xs text-[var(--muted)]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div className="mt-4 grid gap-4 text-sm text-[var(--muted)] md:grid-cols-2">
          {ctx.weather ? (
            <Signal title="Weather">
              {Math.round(ctx.weather.temp)}° · {ctx.weather.description} ·{" "}
              {ctx.weather.location}
            </Signal>
          ) : null}
          {ctx.mood ? (
            <Signal title="Mood">
              {ctx.mood.mood}/10
              {ctx.mood.note ? ` — ${ctx.mood.note}` : ""}
            </Signal>
          ) : null}
          {ctx.water ? (
            <Signal title="Water">
              {ctx.water.glasses}/{ctx.water.goal} glasses
            </Signal>
          ) : null}
          {ctx.completed_tasks.length > 0 ? (
            <Signal title="Completed tasks">
              <ul className="list-disc pl-4">
                {ctx.completed_tasks.map((t) => (
                  <li key={`${t.title}-${t.updated_at}`}>{t.title}</li>
                ))}
              </ul>
            </Signal>
          ) : null}
          {ctx.priorities.length > 0 ? (
            <Signal title="Priorities">
              <ul className="list-disc pl-4">
                {ctx.priorities.map((p) => (
                  <li key={`${p.tier}-${p.title}`}>
                    [{p.tier}] {p.title}
                    {p.done ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            </Signal>
          ) : null}
          {ctx.habits.length > 0 ? (
            <Signal title="Habits">
              <ul className="list-disc pl-4">
                {ctx.habits.map((h) => (
                  <li key={h.name}>
                    {h.name}
                    {h.completed ? " ✓" : ""}
                  </li>
                ))}
              </ul>
            </Signal>
          ) : null}
          {ctx.calendar.length > 0 ? (
            <Signal title="Calendar">
              <ul className="list-disc pl-4">
                {ctx.calendar.map((e) => (
                  <li key={`${e.starts_at}-${e.title}`}>
                    {e.title}{" "}
                    <span className="text-xs opacity-70">({e.source})</span>
                  </li>
                ))}
              </ul>
            </Signal>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Signal({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--ink)]">
        {title}
      </p>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}
