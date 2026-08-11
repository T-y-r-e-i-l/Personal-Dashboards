"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { uploadNoteMedia } from "@/lib/media/noteMedia";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { useToast } from "@/components/ui/Toast";
import type { Capture } from "@/lib/database.types";

type Mode = "markdown" | "preview";
type Visibility = "private" | "public";

export function QuickCapture({ userId }: { userId: string }) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [mode, setMode] = useState<Mode>("markdown");
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
        .limit(8);

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
        .limit(8);
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((row) => ({
        ...row,
        visibility: "private" as Visibility,
        updated_at: row.created_at,
      })) as Capture[];
    },
  });

  const capture = useMutation({
    mutationFn: async ({
      text,
      visibility: noteVisibility,
    }: {
      text: string;
      visibility: Visibility;
    }) => {
      const now = new Date().toISOString();
      const withVisibility = await supabase.from("captures").insert({
        user_id: userId,
        content: text,
        visibility: noteVisibility,
        updated_at: now,
      });
      if (!withVisibility.error) return;

      const basic = await supabase.from("captures").insert({
        user_id: userId,
        content: text,
        updated_at: now,
      });
      if (basic.error) throw basic.error;
    },
    onSuccess: async () => {
      setContent("");
      setVisibility("private");
      setMode("markdown");
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 600);
      showToast("Captured");
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  const updateCapture = useMutation({
    mutationFn: async ({
      id,
      text,
      visibility: noteVisibility,
    }: {
      id: string;
      text: string;
      visibility: Visibility;
    }) => {
      const now = new Date().toISOString();
      const withStamp = await supabase
        .from("captures")
        .update({
          content: text,
          visibility: noteVisibility,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", userId);

      if (!withStamp.error) return;

      const contentOnly = await supabase
        .from("captures")
        .update({ content: text, updated_at: now })
        .eq("id", id)
        .eq("user_id", userId);
      if (contentOnly.error) throw contentOnly.error;
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
    capture.mutate({ text: trimmed, visibility });
  }

  async function onFilesSelected(
    files: FileList | null,
    setText: (updater: (prev: string) => string) => void,
    setEditorMode: (mode: Mode) => void,
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
      setEditorMode("preview");
      showToast("Media added");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="w-full">
      <form onSubmit={onSubmit}>
        <div
          className={`rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ${
            success ? "capture-success" : ""
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <ModeTabs mode={mode} onChange={setMode} />
            <VisibilityToggle value={visibility} onChange={setVisibility} />
          </div>

          {mode === "markdown" ? (
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
              className="w-full resize-y bg-transparent font-mono text-sm leading-relaxed outline-none placeholder:font-[family-name:var(--font-body)] placeholder:text-[var(--muted)]"
            />
          ) : (
            <div className="markdown-body min-h-[104px] rounded-2xl bg-[var(--canvas)]/60 px-3 py-2">
              {content.trim() ? (
                <MarkdownContent content={content} />
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Nothing to preview yet. Switch to Markdown or attach media.
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-[var(--muted)]">⌘/Ctrl + Enter</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) =>
                  void onFilesSelected(e.target.files, setContent, setMode)
                }
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
              onSave={(text, noteVisibility) =>
                updateCapture.mutate({
                  id: item.id,
                  text,
                  visibility: noteVisibility,
                })
              }
              onAddMedia={(files, setText, setEditorMode) =>
                void onFilesSelected(files, setText, setEditorMode)
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
  onSave: (text: string, visibility: Visibility) => void;
  onAddMedia: (
    files: FileList | null,
    setText: (updater: (prev: string) => string) => void,
    setEditorMode: (mode: Mode) => void,
  ) => void;
}) {
  const [draft, setDraft] = useState(item.content);
  const [visibility, setVisibility] = useState<Visibility>(
    item.visibility ?? "private",
  );
  const [mode, setMode] = useState<Mode>("markdown");
  const editFileRef = useRef<HTMLInputElement>(null);
  const stamp = item.updated_at || item.created_at;
  const edited =
    Boolean(item.updated_at) &&
    new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() >
      1000;

  useEffect(() => {
    if (editing) {
      setDraft(item.content);
      setVisibility(item.visibility ?? "private");
      setMode("markdown");
    }
  }, [editing, item.content, item.visibility]);

  if (editing) {
    return (
      <li className="border-b border-[var(--border)]/70 pb-3 last:border-0 last:pb-0">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <ModeTabs mode={mode} onChange={setMode} />
            <div className="flex items-center gap-3">
              <VisibilityToggle value={visibility} onChange={setVisibility} />
              <time className="text-xs text-[var(--muted)]">
                {format(new Date(stamp), "MMM d · h:mm a")}
                {edited ? " · edited" : ""}
              </time>
            </div>
          </div>

          {mode === "markdown" ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = draft.trim();
                  if (trimmed) onSave(trimmed, visibility);
                }
                if (e.key === "Escape") onCancelEdit();
              }}
              rows={5}
              className="w-full resize-y bg-transparent font-mono text-sm leading-relaxed outline-none"
              autoFocus
            />
          ) : (
            <div className="markdown-body min-h-[100px] rounded-xl bg-[var(--canvas)]/60 px-3 py-2">
              {draft.trim() ? (
                <MarkdownContent content={draft} />
              ) : (
                <p className="text-sm text-[var(--muted)]">Nothing to preview.</p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={editFileRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => onAddMedia(e.target.files, setDraft, setMode)}
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
                  if (trimmed) onSave(trimmed, visibility);
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
      <button
        type="button"
        onClick={onStartEdit}
        className="markdown-body min-w-0 flex-1 rounded-xl text-left text-sm text-[var(--ink)] outline-none transition hover:bg-[var(--surface-soft)]/70 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        title="Edit note"
      >
        <MarkdownContent content={item.content} compact />
      </button>
      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
        <time className="text-xs text-[var(--muted)]">
          {format(new Date(stamp), "MMM d · h:mm a")}
          {edited ? " · edited" : ""}
        </time>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          {item.visibility === "public" ? "Public" : "Private"}
        </span>
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

function VisibilityToggle({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-[var(--surface-soft)] p-1"
      role="group"
      aria-label="Note visibility"
    >
      <button
        type="button"
        onClick={() => onChange("private")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
          value === "private"
            ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--ink)]"
        }`}
      >
        Private
      </button>
      <button
        type="button"
        onClick={() => onChange("public")}
        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
          value === "public"
            ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
            : "text-[var(--muted)] hover:text-[var(--ink)]"
        }`}
      >
        Public
      </button>
    </div>
  );
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full bg-[var(--surface-soft)] p-1"
      role="tablist"
      aria-label="Editor mode"
    >
      <ModeButton active={mode === "markdown"} onClick={() => onChange("markdown")}>
        Markdown
      </ModeButton>
      <ModeButton active={mode === "preview"} onClick={() => onChange("preview")}>
        Preview
      </ModeButton>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
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
