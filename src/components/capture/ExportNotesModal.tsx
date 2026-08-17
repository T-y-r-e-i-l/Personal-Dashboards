"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { fetchCapturesInRange } from "@/lib/capture/fetchCapturesInRange";
import {
  downloadExport,
  exportCapturesBulk,
} from "@/lib/export/buildNotesZip";
import { useToast } from "@/components/ui/Toast";
import type { Capture } from "@/lib/database.types";

type ExportMode = "view" | "all" | "day" | "range";

/** Parse a `yyyy-MM-dd` value into a local Date (midnight local time). */
function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ExportNotesModal({
  userId,
  currentViewNotes,
  currentViewLabel,
  onClose,
}: {
  userId: string;
  currentViewNotes: Capture[];
  currentViewLabel: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const showToast = useToast((s) => s.show);
  const today = format(new Date(), "yyyy-MM-dd");

  const [mode, setMode] = useState<ExportMode>("view");
  const [day, setDay] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !exporting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exporting, onClose]);

  const rangeInvalid =
    mode === "range" &&
    (() => {
      const start = parseLocalDate(from);
      const end = parseLocalDate(to);
      return !start || !end || start.getTime() > end.getTime();
    })();

  async function resolveExport(): Promise<{
    captures: Capture[];
    filenameBase: string;
  } | null> {
    if (mode === "view") {
      return {
        captures: currentViewNotes,
        filenameBase: `ghost-writer-notes-${currentViewLabel.toLowerCase()}`,
      };
    }

    if (mode === "all") {
      const captures = await fetchCapturesInRange(
        supabase,
        userId,
        null,
        null,
        5000,
      );
      return { captures, filenameBase: "ghost-writer-notes-all" };
    }

    if (mode === "day") {
      const base = parseLocalDate(day);
      if (!base) {
        showToast("Pick a valid day.");
        return null;
      }
      const captures = await fetchCapturesInRange(
        supabase,
        userId,
        startOfDay(base).toISOString(),
        endOfDay(base).toISOString(),
      );
      return { captures, filenameBase: `ghost-writer-notes-${day}` };
    }

    const start = parseLocalDate(from);
    const end = parseLocalDate(to);
    if (!start || !end || start.getTime() > end.getTime()) {
      showToast("Pick a valid date range.");
      return null;
    }
    const captures = await fetchCapturesInRange(
      supabase,
      userId,
      startOfDay(start).toISOString(),
      endOfDay(end).toISOString(),
    );
    return { captures, filenameBase: `ghost-writer-notes-${from}_to_${to}` };
  }

  async function onExport() {
    if (exporting || rangeInvalid) return;
    setExporting(true);
    try {
      const resolved = await resolveExport();
      if (!resolved) return;
      if (resolved.captures.length === 0) {
        showToast("No notes to export for that selection.");
        return;
      }
      const result = await exportCapturesBulk(
        supabase,
        resolved.captures,
        resolved.filenameBase,
      );
      downloadExport(result);
      showToast(
        `Exported ${resolved.captures.length} note${
          resolved.captures.length === 1 ? "" : "s"
        }`,
      );
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const modes: { value: ExportMode; label: string }[] = [
    { value: "view", label: `Current view (${currentViewLabel})` },
    { value: "day", label: "A specific day" },
    { value: "range", label: "Date range" },
    { value: "all", label: "All notes" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-notes-title"
        className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-6 shadow-xl"
      >
        <h2
          id="export-notes-title"
          className="font-[family-name:var(--font-body)] text-lg font-semibold text-[var(--ink)]"
        >
          Export notes
        </h2>
        <p className="mt-1 font-[family-name:var(--font-body)] text-sm text-[var(--muted)]">
          Downloads a ZIP of Markdown files (with media and YAML front-matter) —
          ready to drop into Obsidian or any second brain.
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">What to export</legend>
          {modes.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm transition ${
                mode === option.value
                  ? "border-[var(--ink)] bg-[var(--surface-soft)]"
                  : "border-[var(--border)] hover:border-[var(--ink)]"
              }`}
            >
              <input
                type="radio"
                name="export-mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="accent-[var(--ink)]"
              />
              <span className="font-[family-name:var(--font-body)] text-[var(--ink)]">
                {option.label}
              </span>
            </label>
          ))}
        </fieldset>

        {mode === "day" ? (
          <label className="mt-4 block">
            <span className="font-[family-name:var(--font-body)] text-xs font-medium text-[var(--muted)]">
              Day
            </span>
            <input
              type="date"
              value={day}
              max={today}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1 box-border h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
          </label>
        ) : null}

        {mode === "range" ? (
          <div className="mt-4 flex gap-3">
            <label className="block flex-1">
              <span className="font-[family-name:var(--font-body)] text-xs font-medium text-[var(--muted)]">
                From
              </span>
              <input
                type="date"
                value={from}
                max={to || today}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 box-border h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
            </label>
            <label className="block flex-1">
              <span className="font-[family-name:var(--font-body)] text-xs font-medium text-[var(--muted)]">
                To
              </span>
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 box-border h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
            </label>
          </div>
        ) : null}

        {rangeInvalid ? (
          <p className="mt-2 font-[family-name:var(--font-body)] text-xs text-[var(--danger,#c0392b)]">
            The start date must be on or before the end date.
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2 font-[family-name:var(--font-body)] text-sm">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded-full px-3.5 py-2 font-medium text-[var(--muted)] transition hover:text-[var(--ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onExport()}
            disabled={exporting || rangeInvalid}
            className="rounded-full bg-[var(--ink)] px-4 py-2 font-medium text-[var(--canvas)] transition disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
