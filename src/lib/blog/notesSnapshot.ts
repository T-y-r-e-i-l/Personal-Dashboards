import type { NoteSnapshot } from "@/lib/blog/types";
import type { Json } from "@/lib/database.types";

export function parseNotesSnapshot(value: Json): NoteSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.content !== "string") {
        return null;
      }
      return {
        id: row.id,
        content: row.content,
        visibility:
          row.visibility === "public" ? ("public" as const) : ("private" as const),
        created_at:
          typeof row.created_at === "string"
            ? row.created_at
            : new Date(0).toISOString(),
      };
    })
    .filter((n): n is NoteSnapshot => Boolean(n));
}
