import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPostDateTitle } from "@/lib/blog/dayRange";

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: posts, error } = await supabase
    .from("blog_posts")
    .select("id, post_date, private_summary, is_public, generated_at")
    .eq("user_id", user.id)
    .order("post_date", { ascending: false });

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
          End-of-day posts generated automatically around 11pm in your timezone —
          summary plus your original notes.
        </p>
      </div>

      {!posts?.length ? (
        <p className="text-sm text-[var(--muted)]">
          No posts yet. Capture notes and live your day — a post appears after
          tonight&apos;s generation window.
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
