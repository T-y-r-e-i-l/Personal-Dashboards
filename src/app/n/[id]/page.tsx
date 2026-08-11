import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("captures")
    .select("id, content, created_at, updated_at, visibility")
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();

  if (error || !note) notFound();

  const stamp = note.updated_at || note.created_at;

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-14">
      <GhostWriterLogo markSize={22} className="text-sm text-[var(--muted)]" />
      <p className="mt-6 font-[family-name:var(--font-body)] text-xs font-normal text-[var(--muted)]">
        Shared note
      </p>
      <time
        dateTime={stamp}
        className="mt-1 block font-[family-name:var(--font-body)] text-sm font-normal text-[var(--muted)]"
      >
        {format(new Date(stamp), "MMMM d, yyyy · h:mm a")}
      </time>

      <article className="notes-hand markdown-body mt-8">
        <MarkdownContent content={note.content} />
      </article>
    </main>
  );
}
