import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatPostDateTitle } from "@/lib/blog/dayRange";
import { parseNotesSnapshot } from "@/lib/blog/notesSnapshot";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { PublishToggle } from "@/components/blog/PublishToggle";
import { DaySignals } from "@/components/blog/DaySignals";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("user_id", user.id)
    .eq("post_date", date)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-[var(--danger)]">{error.message}</p>
      </main>
    );
  }

  if (!post) notFound();

  const notes = parseNotesSnapshot(post.notes_snapshot);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/blog"
            className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← Blog
          </Link>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {formatPostDateTitle(post.post_date)}
          </h1>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Generated {format(new Date(post.generated_at), "MMM d · h:mm a")}
            {post.model ? ` · ${post.model}` : ""}
          </p>
        </div>
        <PublishToggle postId={post.id} initialPublic={post.is_public} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Summary</h2>
        <div className="markdown-body rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <MarkdownContent content={post.private_summary} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Notes</h2>
        {notes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No notes captured this day.</p>
        ) : (
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
        )}
      </section>

      <DaySignals dayContext={post.day_context} />
    </main>
  );
}
