"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import {
  FormEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  downloadExport,
  exportCapturesBulk,
  exportSingleCapture,
} from "@/lib/export/buildNotesZip";
import { uploadNoteMedia } from "@/lib/media/noteMedia";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { useCaptureDraft } from "@/components/capture/captureDraftStore";
import { useToast } from "@/components/ui/Toast";
import type { Capture } from "@/lib/database.types";
import { playUiSound } from "@/lib/sounds/play";

type Visibility = "private" | "public";
type NotesRange = "today" | "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: NotesRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

function escapeIlike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function notesRangeBounds(range: NotesRange): { start: string; end: string } | null {
  if (range === "all") return null;
  const now = new Date();
  const end = endOfDay(now).toISOString();
  if (range === "today") {
    return { start: startOfDay(now).toISOString(), end };
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return {
    start: startOfDay(subDays(now, days - 1)).toISOString(),
    end,
  };
}

function mapCaptures(
  rows: Array<Record<string, unknown>>,
  fallbackPrivate = false,
): Capture[] {
  return rows.map((row) => ({
    ...row,
    visibility: (fallbackPrivate
      ? "private"
      : ((row.visibility as Visibility | null | undefined) ?? "private")) as Visibility,
    updated_at:
      (row.updated_at as string | null | undefined) ??
      (row.created_at as string),
  })) as Capture[];
}

export function QuickCapture({ userId }: { userId: string }) {
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [range, setRange] = useState<NotesRange>("today");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const showToast = useToast((s) => s.show);
  const queryClient = useQueryClient();
  const supabase = createClient();
  const rangeLabel =
    RANGE_OPTIONS.find((option) => option.value === range)?.label ?? "notes";

  const rangeBounds = useMemo(() => notesRangeBounds(range), [range]);
  const limit = range === "today" ? 50 : range === "all" ? 500 : 100;

  const recent = useQuery({
    queryKey: ["captures", userId, range, deferredSearch || null],
    queryFn: async () => {
      let primary = supabase
        .from("captures")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (rangeBounds) {
        primary = primary
          .gte("created_at", rangeBounds.start)
          .lte("created_at", rangeBounds.end);
      }
      if (deferredSearch) {
        primary = primary.ilike("content", `%${escapeIlike(deferredSearch)}%`);
      }

      const primaryResult = await primary;
      if (!primaryResult.error) {
        return mapCaptures(primaryResult.data ?? []);
      }

      let fallback = supabase
        .from("captures")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (rangeBounds) {
        fallback = fallback
          .gte("created_at", rangeBounds.start)
          .lte("created_at", rangeBounds.end);
      }
      if (deferredSearch) {
        fallback = fallback.ilike(
          "content",
          `%${escapeIlike(deferredSearch)}%`,
        );
      }

      const fallbackResult = await fallback;
      if (fallbackResult.error) throw fallbackResult.error;
      return mapCaptures(fallbackResult.data ?? [], true);
    },
  });

  const capture = useMutation({
    mutationFn: async (text: string) => {
      const now = new Date().toISOString();
      const attempts = [
        {
          user_id: userId,
          content: text,
          visibility: "private" as const,
          updated_at: now,
        },
        {
          user_id: userId,
          content: text,
          visibility: "private" as const,
        },
        {
          user_id: userId,
          content: text,
          updated_at: now,
        },
        {
          user_id: userId,
          content: text,
        },
      ] as const;

      let lastError: Error | null = null;
      for (const row of attempts) {
        const { error } = await supabase.from("captures").insert(row);
        if (!error) return;
        lastError = error;
        // Retry only for missing-column / schema-cache drift.
        if (!/column|schema cache/i.test(error.message)) throw error;
      }
      throw lastError ?? new Error("Failed to save capture");
    },
    onSuccess: async () => {
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 600);
      playUiSound("capture_note");
      showToast("Captured");
      useCaptureDraft.getState().notifyCaptureSuccess();
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message, { variant: "error" }),
  });

  const updateCapture = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const now = new Date().toISOString();
      const attempts = [
        { content: text, updated_at: now },
        { content: text },
      ] as const;

      let lastError: Error | null = null;
      for (const patch of attempts) {
        const { error } = await supabase
          .from("captures")
          .update(patch)
          .eq("id", id)
          .eq("user_id", userId);
        if (!error) return;
        lastError = error;
        if (!/column|schema cache/i.test(error.message)) throw error;
      }
      throw lastError ?? new Error("Failed to update note");
    },
    onSuccess: async () => {
      setEditingId(null);
      showToast("Note updated");
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const deleteCapture = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("captures")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (editingId) setEditingId(null);
      showToast("Note deleted");
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const shareCapture = useMutation({
    mutationFn: async (id: string) => {
      const attempts = [
        { visibility: "public" as const, updated_at: new Date().toISOString() },
        { visibility: "public" as const },
      ] as const;

      let lastError: Error | null = null;
      for (const patch of attempts) {
        const { error } = await supabase
          .from("captures")
          .update(patch)
          .eq("id", id)
          .eq("user_id", userId);
        if (!error) return;
        lastError = error;
        if (!/column|schema cache/i.test(error.message)) throw error;
      }
      throw lastError ?? new Error("Failed to share note");
    },
    onSuccess: async (_data, id) => {
      const url = `${window.location.origin}/n/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast("Share link copied");
      } catch {
        showToast(url);
      }
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  async function onFilesSelected(
    files: FileList | null,
    setText: (updater: (prev: string) => string) => void,
  ) {
    if (!files?.length) return;
    setUploading(true);

    try {
      const snippets: string[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadNoteMedia(supabase, userId, file);
        snippets.push(uploaded.markdown);
      }

      setText((prev) => {
        const base = prev.trimEnd();
        const block = snippets.join("\n\n");
        return base ? `${base}\n\n${block}` : block;
      });
      showToast("Media added");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onExportVisible() {
    const notes = recent.data ?? [];
    if (!notes.length || exporting) return;
    setExporting(true);
    try {
      const result = await exportCapturesBulk(supabase, notes);
      downloadExport(result);
      showToast(`Exported ${notes.length} note${notes.length === 1 ? "" : "s"}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onDownloadNote(item: Capture) {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportSingleCapture(supabase, item);
      downloadExport(result);
      showToast("Note downloaded");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="notes-hand w-full">
      <CaptureComposer
        pending={capture.isPending}
        uploading={uploading}
        success={success}
        onCapture={(text) => capture.mutate(text)}
        onFilesSelected={onFilesSelected}
      />

      <div className="mt-4 flex items-center gap-2 font-[family-name:var(--font-body)] text-sm font-normal">
        {searchOpen || search ? (
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search notes</span>
            <input
              type="search"
              value={search}
              autoFocus
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (search) {
                    setSearch("");
                  } else {
                    setSearchOpen(false);
                  }
                }
              }}
              onBlur={() => {
                if (!search.trim()) setSearchOpen(false);
              }}
              placeholder="Search notes…"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--ink)]"
            />
          </label>
        ) : (
          <button
            type="button"
            aria-label="Search notes"
            title="Search notes"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--ink)] hover:text-[var(--ink)]"
          >
            <SearchIcon />
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="sr-only">Notes range</span>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as NotesRange)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void onExportVisible()}
            disabled={
              exporting || !recent.data?.length || recent.isLoading
            }
            title={`Export ${rangeLabel.toLowerCase()} as Markdown`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
          >
            {exporting ? "Exporting…" : `Export ${rangeLabel}`}
          </button>
          {search || range !== "today" ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setRange("today");
                setSearchOpen(false);
              }}
              className="rounded-full px-2.5 py-2 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {recent.isLoading ? (
        <p className="mt-4 font-[family-name:var(--font-body)] text-sm text-[var(--muted)]">
          Loading notes…
        </p>
      ) : recent.data && recent.data.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {recent.data.map((item) => (
            <CaptureListItem
              key={item.id}
              item={item}
              editing={editingId === item.id}
              saving={updateCapture.isPending && editingId === item.id}
              uploading={uploading}
              sharing={shareCapture.isPending}
              deleting={deleteCapture.isPending}
              downloading={exporting}
              onStartEdit={() => setEditingId(item.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(text) =>
                updateCapture.mutate({
                  id: item.id,
                  text,
                })
              }
              onDelete={() => {
                if (
                  window.confirm("Delete this note? This cannot be undone.")
                ) {
                  deleteCapture.mutate(item.id);
                }
              }}
              onShare={() => shareCapture.mutate(item.id)}
              onDownload={() => void onDownloadNote(item)}
              onAddMedia={(files, setText) =>
                void onFilesSelected(files, setText)
              }
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 font-[family-name:var(--font-body)] text-sm text-[var(--muted)]">
          {deferredSearch
            ? "No notes match these filters."
            : range === "today"
              ? "No notes yet today."
              : "No notes in this range."}
        </p>
      )}
    </section>
  );
}

function useDebouncedDocumentEditSound() {
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);
  return () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      playUiSound("document_edit");
      timerRef.current = null;
    }, 400);
  };
}

function CaptureComposer({
  pending,
  uploading,
  success,
  onCapture,
  onFilesSelected,
}: {
  pending: boolean;
  uploading: boolean;
  success: boolean;
  onCapture: (text: string) => void;
  onFilesSelected: (
    files: FileList | null,
    setText: (updater: (prev: string) => string) => void,
  ) => void;
}) {
  const [content, setContent] = useState("");
  const [focusFlash, setFocusFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const pendingText = useCaptureDraft((s) => s.pendingText);
  const consumeDraft = useCaptureDraft((s) => s.consumeDraft);
  const bumpDocumentEdit = useDebouncedDocumentEditSound();

  useEffect(() => {
    if (success) setContent("");
  }, [success]);

  useEffect(() => {
    if (pendingText == null) return;
    const draft = consumeDraft();
    if (!draft) return;
    setContent((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed}\n\n${draft.text}` : draft.text;
    });
    setFocusFlash(true);
    window.requestAnimationFrame(() => {
      const shell = shellRef.current;
      const el = textareaRef.current;
      shell?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (!el) return;
      el.focus({ preventScroll: true });
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, [pendingText, consumeDraft]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onCapture(trimmed);
  }

  return (
    <form onSubmit={onSubmit}>
      <div
        ref={shellRef}
        onAnimationEnd={(e) => {
          if (e.animationName === "capture-focus") setFocusFlash(false);
        }}
        className={`rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ${
          success ? "capture-success" : ""
        } ${focusFlash ? "capture-focus" : ""}`}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            bumpDocumentEdit();
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit(e);
            }
          }}
          rows={4}
          placeholder="Capture a thought..."
          className="w-full resize-y bg-transparent font-[family-name:var(--font-body)] text-sm outline-none placeholder:text-[var(--muted)]"
        />

        <div className="mt-3 flex items-center justify-between gap-3 font-[family-name:var(--font-body)] text-sm font-normal">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                void onFilesSelected(e.target.files, setContent);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--canvas)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              title="Upload media"
            >
              <PaperclipIcon />
              {uploading ? "Uploading…" : "Add media"}
            </button>
          </div>
          <button
            type="submit"
            disabled={pending || !content.trim() || uploading}
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
          >
            Capture
          </button>
        </div>
      </div>
    </form>
  );
}

function CaptureListItem({
  item,
  editing,
  saving,
  uploading,
  sharing,
  deleting,
  downloading,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onShare,
  onDownload,
  onAddMedia,
}: {
  item: Capture;
  editing: boolean;
  saving: boolean;
  uploading: boolean;
  sharing: boolean;
  deleting: boolean;
  downloading: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
  onShare: () => void;
  onDownload: () => void;
  onAddMedia: (
    files: FileList | null,
    setText: (updater: (prev: string) => string) => void,
  ) => void;
}) {
  const [draft, setDraft] = useState(item.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bumpDocumentEdit = useDebouncedDocumentEditSound();
  const stamp = item.updated_at || item.created_at;
  const edited =
    Boolean(item.updated_at) &&
    new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() >
      1000;
  const shared = item.visibility === "public";

  useEffect(() => {
    if (editing) {
      setDraft(item.content);
    }
  }, [editing, item.content]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (editing) {
    return (
      <li className="border-b border-[var(--border)]/70 pb-3 last:border-0 last:pb-0">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-end gap-3 font-[family-name:var(--font-body)] text-sm font-normal">
            <time className="text-xs text-[var(--muted)]">
              {format(new Date(stamp), "MMM d · h:mm a")}
              {edited ? " · edited" : ""}
            </time>
          </div>

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              bumpDocumentEdit();
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                const trimmed = draft.trim();
                if (trimmed) onSave(trimmed);
              }
              if (e.key === "Escape") onCancelEdit();
            }}
            rows={5}
            className="w-full resize-y bg-transparent font-[family-name:var(--font-body)] outline-none"
            autoFocus
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-[family-name:var(--font-body)] text-sm font-normal">
            <div className="flex items-center gap-2">
              <input
                ref={editFileRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => onAddMedia(e.target.files, setDraft)}
              />
              <button
                type="button"
                onClick={() => editFileRef.current?.click()}
                disabled={uploading || saving}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                <PaperclipIcon />
                {uploading ? "Uploading…" : "Add media"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={saving}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = draft.trim();
                  if (trimmed) onSave(trimmed);
                }}
                disabled={saving || uploading || !draft.trim()}
                className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex flex-col gap-2 border-t border-[var(--border)] py-4">
      <div className="flex w-full shrink-0 items-center justify-between gap-3 font-[family-name:var(--font-body)] text-sm font-normal">
        <time className="text-xs text-[var(--muted)]">
          {format(new Date(stamp), "MMM d · h:mm a")}
          {edited ? " · edited" : ""}
          {shared ? " · shared" : ""}
        </time>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Note actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
          >
            <KebabIcon />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 min-w-[9.5rem] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-soft)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onStartEdit();
                }}
                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)]"
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDownload();
                }}
                disabled={downloading}
                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                Download
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onShare();
                }}
                disabled={sharing}
                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                {shared ? "Copy link" : "Share"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                disabled={deleting}
                className="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button, a, video, audio")) return;
          onStartEdit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onStartEdit();
          }
        }}
        className="markdown-body min-w-0 w-full cursor-pointer rounded-xl text-left text-[var(--ink)] outline-none transition hover:bg-[var(--surface-soft)]/70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        title="Edit note"
      >
        <MarkdownContent content={item.content} compact />
      </div>
    </li>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="m16.5 16.5 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11.5 12.5 20a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 1 1-2.8-2.8L16 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
