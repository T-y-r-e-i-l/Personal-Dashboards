import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { GhostWriterLogo } from "@/components/brand/GhostWriterLogo";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { SharedNoteTheme } from "@/components/capture/SharedNoteTheme";
import {
  fetchPublicNoteAuthor,
  type PublicNoteAuthor,
} from "@/lib/selfie/publicAuthor";

/** Unlisted share links — keep out of search and AI indexes. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      nosnippet: true,
      noarchive: true,
    },
  },
};

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

function AuthorRow({ author }: { author: PublicNoteAuthor }) {
  return (
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
  );
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

  const retro = author?.retroUiEnabled === true;
  const stampLabel = format(new Date(stamp), "MMMM d, yyyy · h:mm a");

  return (
    <>
      {retro ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.dataset.theme="retro"`,
          }}
        />
      ) : null}
      <SharedNoteTheme retroUiEnabled={retro} />

      <main className="mx-auto min-h-screen w-full max-w-2xl px-6 py-14">
        <GhostWriterLogo markSize={22} className="text-sm text-[var(--muted)]" />

        {retro ? (
          <div className="panel-card shared-note-window mt-8 overflow-hidden">
            <div className="panel-title-bar flex items-center gap-2 px-2 py-1">
              <div className="panel-title-stripes" aria-hidden />
              <span
                className="panel-close-box pointer-events-none shrink-0"
                aria-hidden
              />
              <h1 className="panel-title-label relative z-[1] text-sm font-semibold tracking-tight">
                Shared note
              </h1>
            </div>
            <div className="panel-body space-y-3 px-4 py-4">
              {author ? <AuthorRow author={author} /> : null}
              <time
                dateTime={stamp}
                className="block font-[family-name:var(--font-body)] text-sm font-normal text-[var(--muted)]"
              >
                {stampLabel}
              </time>
              <article className="notes-hand markdown-body pt-2">
                <MarkdownContent content={note.content} />
              </article>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-6 font-[family-name:var(--font-body)] text-xs font-normal text-[var(--muted)]">
              Shared note
            </p>
            {author ? <AuthorRow author={author} /> : null}
            <time
              dateTime={stamp}
              className="mt-2 block font-[family-name:var(--font-body)] text-sm font-normal text-[var(--muted)]"
            >
              {stampLabel}
            </time>
            <article className="notes-hand markdown-body mt-8">
              <MarkdownContent content={note.content} />
            </article>
          </>
        )}
      </main>
    </>
  );
}
