import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatPostDateTitle } from "@/lib/blog/dayRange";
import { parseNotesSnapshot } from "@/lib/blog/notesSnapshot";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PublicBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("blog_posts")
    .select(
      "id, post_date, public_summary, notes_snapshot, is_public, generated_at",
    )
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !post) notFound();

  const notes = parseNotesSnapshot(post.notes_snapshot).filter(
    (n) => n.visibility === "public",
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-14">
      <GhostWriterLogo markSize={22} className="text-sm text-[var(--muted)]" />
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight">
        {formatPostDateTitle(post.post_date)}
      </h1>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {format(new Date(post.generated_at), "MMM d, yyyy")}
      </p>

      <section className="mt-10">
        <div className="markdown-body">
          <MarkdownContent content={post.public_summary} />
        </div>
      </section>

      {notes.length > 0 ? (
        <section className="mt-12 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 text-sm font-semibold tracking-tight">Notes</h2>
          <ul className="notes-hand space-y-6">
            {notes.map((note) => (
              <li key={note.id}>
                <time className="mb-2 block font-[family-name:var(--font-body)] text-xs font-normal text-[var(--muted)]">
                  {format(new Date(note.created_at), "h:mm a")}
                </time>
                <div className="markdown-body">
                  <MarkdownContent content={note.content} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
