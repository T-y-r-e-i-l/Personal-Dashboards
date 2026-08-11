import { format } from "date-fns";
import type { NoteSnapshot } from "@/lib/blog/types";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";

export function DayNotesList({ notes }: { notes: NoteSnapshot[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No notes captured this day.</p>
    );
  }

  return (
    <ul className="space-y-4">
      {notes.map((note) => (
        <li
          key={note.id}
          className="border-b border-[var(--border)]/70 pb-4 last:border-0"
        >
          <div className="mb-2 flex items-center justify-between gap-3 font-[family-name:var(--font-body)] text-sm font-normal">
            <time className="text-xs text-[var(--muted)]">
              {format(new Date(note.created_at), "h:mm a")}
            </time>
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {note.visibility}
            </span>
          </div>
          <div className="notes-hand markdown-body">
            <MarkdownContent content={note.content} />
          </div>
        </li>
      ))}
    </ul>
  );
}
