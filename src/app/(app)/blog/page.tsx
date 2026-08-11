import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPostDateTitle, getDayRange } from "@/lib/blog/dayRange";

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: posts, error }] = await Promise.all([
    supabase
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("blog_posts")
      .select("id, post_date, private_summary, is_public, generated_at")
      .eq("user_id", user.id)
      .order("post_date", { ascending: false }),
  ]);

  const timeZone = profile?.timezone || "UTC";
  const todayDate = getDayRange(timeZone).postDate;

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Blog</h1>
        <p className="mt-4 text-sm text-[var(--danger)]">
          Could not load posts. Run the blog_posts migration in Supabase if you
          haven&apos;t yet. ({error.message})
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Blog
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Browse any day as a dashboard — panels and notes for that date, plus an
          end-of-day digest when one has been generated.
        </p>
        <p className="mt-4">
          <Link
            href={`/blog/${todayDate}`}
            className="text-sm font-medium text-[var(--foreground)] underline-offset-4 hover:underline"
          >
            Open today (day view)
          </Link>
        </p>
      </div>

      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        Digest archive
      </h2>

      {!posts?.length ? (
        <p className="text-sm text-[var(--muted)]">
          No digests yet. Open any day to see panels and notes; digests appear after
          the evening generation window.
        </p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => {
            const excerpt =
              post.private_summary.replace(/\s+/g, " ").trim().slice(0, 160) +
              (post.private_summary.length > 160 ? "…" : "");
            return (
              <li key={post.id}>
                <Link
                  href={`/blog/${post.post_date}`}
                  className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition hover:bg-[var(--surface-soft)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold tracking-tight">
                      {formatPostDateTitle(post.post_date)}
                    </h2>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                      {post.is_public ? "Public" : "Private"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {excerpt}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
