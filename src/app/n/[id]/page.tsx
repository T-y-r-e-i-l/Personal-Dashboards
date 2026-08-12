import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import {
  fetchPublicNoteAuthor,
  type PublicNoteAuthor,
} from "@/lib/selfie/publicAuthor";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function fetchSharedNote(id: string) {
  const select =
    "id, user_id, content, created_at, updated_at, visibility" as const;

  // Prefer service role so unlisted public notes work even before/without
  // the captures_public_read RLS policy being applied.
  try {
    const admin = createAdminClient();
    const result = await admin
      .from("captures")
      .select(select)
      .eq("id", id)
      .eq("visibility", "public")
      .maybeSingle();
    if (!result.error) return { ...result, admin };
  } catch {
    // Missing SUPABASE_SERVICE_ROLE_KEY in local/dev — fall through.
  }

  const supabase = await createClient();
  const result = await supabase
    .from("captures")
    .select(select)
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();
  return { ...result, admin: null };
}

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const { data: note, error, admin } = await fetchSharedNote(id);
  if (error || !note) notFound();

  const stamp = note.updated_at || note.created_at;

  let author: PublicNoteAuthor | null = null;
  if (admin && note.user_id) {
    try {
      author = await fetchPublicNoteAuthor(admin, note.user_id);
    } catch {
      author = null;
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-14">
      <GhostWriterLogo markSize={22} className="text-sm text-[var(--muted)]" />
      <p className="mt-6 font-[family-name:var(--font-body)] text-xs font-normal text-[var(--muted)]">
        Shared note
      </p>

      {author && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas)]">
            {author.selfieUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={author.selfieUrl}
                alt=""
                className="h-full w-full scale-x-[-1] object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs font-medium text-[var(--muted)]">
                {author.initials}
              </span>
            )}
          </div>
          <p className="font-[family-name:var(--font-body)] text-base font-medium text-[var(--ink)]">
            {author.displayName}
          </p>
        </div>
      )}

      <time
        dateTime={stamp}
        className="mt-2 block font-[family-name:var(--font-body)] text-sm font-normal text-[var(--muted)]"
      >
        {format(new Date(stamp), "MMMM d, yyyy · h:mm a")}
      </time>

      <article className="notes-hand markdown-body mt-8">
        <MarkdownContent content={note.content} />
      </article>
    </main>
  );
}
