"use client";

import type { DashboardPanel } from "@/lib/database.types";
import type { NoteSnapshot } from "@/lib/blog/types";
import { parseDayContextWeather } from "@/lib/blog/parseDayContext";
import { DayChrome } from "@/components/blog/DayChrome";
import { DayNotesList } from "@/components/blog/DayNotesList";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";

export type DayDashboardPost = {
  id: string;
  private_summary: string;
  is_public: boolean;
  generated_at: string;
  model: string | null;
  day_context: unknown;
};

export function DayDashboard({
  userId,
  date,
  todayDate,
  timeZone,
  location,
  post,
  panels,
  notes,
}: {
  userId: string;
  date: string;
  todayDate: string;
  timeZone: string;
  location: string | null;
  post: DayDashboardPost | null;
  panels: DashboardPanel[];
  notes: NoteSnapshot[];
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <DayChrome
        date={date}
        todayDate={todayDate}
        postId={post?.id}
        isPublic={post?.is_public}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Summary</h2>
        {post ? (
          <div className="markdown-body rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
            <MarkdownContent content={post.private_summary} />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No digest yet for this day.
          </p>
        )}
      </section>

      <section className="mt-10">
        <DashboardGrid
          userId={userId}
          panels={panels}
          location={location}
          readOnly
          date={date}
          timeZone={timeZone}
          weatherSnapshot={parseDayContextWeather(post?.day_context)}
          onLayoutChange={() => {}}
          onRemovePanel={() => {}}
          onUpdateConfig={() => {}}
          onSwapPanel={() => {}}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Notes</h2>
        <DayNotesList notes={notes} />
      </section>
    </main>
  );
}
