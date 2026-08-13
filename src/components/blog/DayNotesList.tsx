import { format } from "date-fns";
import type { NoteSnapshot } from "@/lib/blog/types";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { NoteWindow } from "@/components/capture/NoteWindow";

export function DayNotesList({ notes }: { notes: NoteSnapshot[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">No notes captured this day.</p>
    );
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <NoteWindow
          key={note.id}
          as="li"
          title={
            <time dateTime={note.created_at}>
              {format(new Date(note.created_at), "h:mm a")}
            </time>
          }
          meta={<span>{note.visibility}</span>}
        >
          <MarkdownContent content={note.content} />
        </NoteWindow>
      ))}
    </ul>
  );
}
