"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { uploadNoteMedia } from "@/lib/media/noteMedia";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { useToast } from "@/components/ui/Toast";
import type { Capture } from "@/lib/database.types";

type Visibility = "private" | "public";

export function QuickCapture({ userId }: { userId: string }) {
  const [content, setContent] = useState("");
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToast = useToast((s) => s.show);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const recent = useQuery({
    queryKey: ["captures", userId],
    queryFn: async () => {
      const primary = await supabase
        .from("captures")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (!primary.error) {
        return (primary.data ?? []).map((row) => ({
          ...row,
          visibility: (row.visibility ?? "private") as Visibility,
          updated_at: row.updated_at ?? row.created_at,
        })) as Capture[];
      }

      const fallback = await supabase
        .from("captures")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => ({
        ...row,
        visibility: "private" as Visibility,
        updated_at: row.created_at,
      })) as Capture[];
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
      setContent("");
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 600);
      showToast("Captured");
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const updateCapture = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const now = new Date().toISOString();
      const attempts = [
        { content: text, visibility: "private" as const, updated_at: now },
        { content: text, visibility: "private" as const },
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    capture.mutate(trimmed);
  }

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="notes-hand w-full">
      <form onSubmit={onSubmit}>
        <div
          className={`rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ${
            success ? "capture-success" : ""
          }`}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={4}
            placeholder="Capture a thought..."
            className="w-full resize-y bg-transparent outline-none placeholder:text-[var(--muted)]"
          />

          <div className="mt-3 flex items-center justify-between gap-3 font-[family-name:var(--font-body)] text-sm font-normal">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => void onFilesSelected(e.target.files, setContent)}
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
              disabled={capture.isPending || !content.trim() || uploading}
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
            >
              Capture
            </button>
          </div>
        </div>
      </form>

      {recent.data && recent.data.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {recent.data.map((item) => (
            <CaptureListItem
              key={item.id}
              item={item}
              editing={editingId === item.id}
              saving={updateCapture.isPending && editingId === item.id}
              uploading={uploading}
              onStartEdit={() => setEditingId(item.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(text) =>
                updateCapture.mutate({
                  id: item.id,
                  text,
                })
              }
              onAddMedia={(files, setText) =>
                void onFilesSelected(files, setText)
              }
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CaptureListItem({
  item,
  editing,
  saving,
  uploading,
  onStartEdit,
  onCancelEdit,
  onSave,
  onAddMedia,
}: {
  item: Capture;
  editing: boolean;
  saving: boolean;
  uploading: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (text: string) => void;
  onAddMedia: (
    files: FileList | null,
    setText: (updater: (prev: string) => string) => void,
  ) => void;
}) {
  const [draft, setDraft] = useState(item.content);
  const editFileRef = useRef<HTMLInputElement>(null);
  const stamp = item.updated_at || item.created_at;
  const edited =
    Boolean(item.updated_at) &&
    new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() >
      1000;

  useEffect(() => {
    if (editing) {
      setDraft(item.content);
    }
  }, [editing, item.content]);

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
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                const trimmed = draft.trim();
                if (trimmed) onSave(trimmed);
              }
              if (e.key === "Escape") onCancelEdit();
            }}
            rows={5}
            className="w-full resize-y bg-transparent outline-none"
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
    <li className="group flex items-start justify-between gap-4 border-b border-[var(--border)]/70 pb-3 last:border-0 last:pb-0">
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
        className="markdown-body min-w-0 flex-1 cursor-pointer rounded-xl text-left text-[var(--ink)] outline-none transition hover:bg-[var(--surface-soft)]/70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        title="Edit note"
      >
        <MarkdownContent content={item.content} compact />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5 font-[family-name:var(--font-body)] text-sm font-normal">
        <time className="text-xs text-[var(--muted)]">
          {format(new Date(stamp), "MMM d · h:mm a")}
          {edited ? " · edited" : ""}
        </time>
        <button
          type="button"
          onClick={onStartEdit}
          className="text-xs font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          Edit
        </button>
      </div>
    </li>
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
