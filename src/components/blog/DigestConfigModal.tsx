"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import {
  defaultSelectionFromInventory,
  selectionHasSignal,
  type DigestActivityKey,
  type DigestSelection,
  type DigestSourcesInventory,
} from "@/lib/blog/digestSelection";

type SourcesResponse = DigestSourcesInventory & {
  ok?: boolean;
  error?: string;
};

export function DigestConfigModal({
  date,
  hasPost,
  onClose,
}: {
  date: string;
  hasPost: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const showToast = useToast((s) => s.show);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<DigestSourcesInventory | null>(
    null,
  );
  const [selection, setSelection] = useState<DigestSelection | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/blog/digest-sources?date=${encodeURIComponent(date)}`,
        );
        const data = (await res.json().catch(() => ({}))) as SourcesResponse;
        if (!res.ok || !data.notes || !data.activities) {
          if (!cancelled) {
            setError(data.error || "Could not load sources for this day.");
            setInventory(null);
            setSelection(null);
          }
          return;
        }
        if (cancelled) return;
        const inv: DigestSourcesInventory = {
          postDate: data.postDate,
          notes: data.notes,
          activities: data.activities,
        };
        setInventory(inv);
        setSelection(defaultSelectionFromInventory(inv));
      } catch {
        if (!cancelled) {
          setError("Could not load sources for this day.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date]);

  const availableActivities = useMemo(
    () => inventory?.activities.filter((a) => a.available) ?? [],
    [inventory],
  );

  const canSubmit =
    Boolean(selection) && selectionHasSignal(selection!) && !submitting;

  function toggleNote(id: string) {
    setSelection((current) => {
      if (!current) return current;
      const has = current.noteIds.includes(id);
      return {
        ...current,
        noteIds: has
          ? current.noteIds.filter((noteId) => noteId !== id)
          : [...current.noteIds, id],
      };
    });
  }

  function toggleActivity(key: DigestActivityKey) {
    setSelection((current) => {
      if (!current) return current;
      return {
        ...current,
        activities: {
          ...current.activities,
          [key]: !current.activities[key],
        },
      };
    });
  }

  function selectAllNotes() {
    if (!inventory) return;
    setSelection((current) =>
      current
        ? { ...current, noteIds: inventory.notes.map((n) => n.id) }
        : current,
    );
  }

  function clearNotes() {
    setSelection((current) =>
      current ? { ...current, noteIds: [] } : current,
    );
  }

  function selectAllActivities() {
    setSelection((current) => {
      if (!current || !inventory) return current;
      const activities = { ...current.activities };
      for (const activity of inventory.activities) {
        if (activity.available) activities[activity.key] = true;
      }
      return { ...current, activities };
    });
  }

  function clearActivities() {
    setSelection((current) => {
      if (!current || !inventory) return current;
      const activities = { ...current.activities };
      for (const activity of inventory.activities) {
        activities[activity.key] = false;
      }
      return { ...current, activities };
    });
  }

  async function onSubmit() {
    if (!selection || !selectionHasSignal(selection)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/blog/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, selection }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: boolean;
        updated?: boolean;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        showToast(data.error || "Could not generate digest.");
        return;
      }

      showToast(
        data.updated
          ? "Digest regenerated"
          : data.created
            ? "Digest generated"
            : "Done",
      );
      onClose();
      router.refresh();
    } catch {
      showToast("Could not generate digest.");
    } finally {
      setSubmitting(false);
    }
  }

  const emptyDay =
    !loading &&
    !error &&
    inventory &&
    inventory.notes.length === 0 &&
    availableActivities.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="digest-config-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-[var(--surface)] p-6 shadow-xl"
      >
        <h2
          id="digest-config-title"
          className="font-[family-name:var(--font-display)] text-2xl"
        >
          Digest sources
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Choose what should inform this day’s digest.
          {hasPost ? " The existing digest will be replaced." : null}
        </p>

        <div className="mt-6 space-y-5">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading sources…</p>
          ) : null}

          {error ? (
            <p className="text-sm text-[var(--danger)]">{error}</p>
          ) : null}

          {emptyDay ? (
            <p className="text-sm text-[var(--muted)]">
              Nothing logged for this day yet.
            </p>
          ) : null}

          {inventory && selection && !emptyDay ? (
            <>
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Activities
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllActivities}
                      className="font-medium text-[var(--accent)]"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearActivities}
                      className="font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {availableActivities.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No activity sources for this day.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {availableActivities.map((activity) => (
                      <li key={activity.key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selection.activities[activity.key]}
                            onChange={() => toggleActivity(activity.key)}
                          />
                          <span className="min-w-0 flex-1 font-medium">
                            {activity.label}
                          </span>
                          {typeof activity.count === "number" ? (
                            <span className="text-xs text-[var(--muted)]">
                              {activity.count}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    Notes
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={selectAllNotes}
                      className="font-medium text-[var(--accent)]"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearNotes}
                      className="font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {inventory.notes.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No notes for this day.
                  </p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
                    {inventory.notes.map((note) => (
                      <li key={note.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selection.noteIds.includes(note.id)}
                            onChange={() => toggleNote(note.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                              <time dateTime={note.created_at}>
                                {format(new Date(note.created_at), "h:mm a")}
                              </time>
                              <span className="uppercase tracking-wide">
                                {note.visibility}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[var(--ink)]">
                              {note.preview}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {!selectionHasSignal(selection) ? (
                <p className="text-xs text-[var(--muted)]">
                  Select at least one note or activity.
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit || emptyDay || Boolean(error)}
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
          >
            {submitting
              ? hasPost
                ? "Regenerating…"
                : "Generating…"
              : hasPost
                ? "Regenerate"
                : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
