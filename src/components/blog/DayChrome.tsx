"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatPostDateTitle,
  isValidPostDate,
  shiftPostDate,
} from "@/lib/blog/dayRange";
import { PublishToggle } from "@/components/blog/PublishToggle";
import { RegenerateDayButton } from "@/components/blog/RegenerateDayButton";

export function DayChrome({
  date,
  todayDate,
  postId,
  isPublic,
  hasAiSummary = false,
}: {
  date: string;
  todayDate: string;
  postId?: string | null;
  isPublic?: boolean;
  hasAiSummary?: boolean;
}) {
  const router = useRouter();
  const prev = shiftPostDate(date, -1);
  const next = shiftPostDate(date, 1);

  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <Link
          href="/blog"
          className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Blog
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          {formatPostDateTitle(date)}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/blog/${prev}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
          >
            Previous
          </Link>
          <Link
            href={`/blog/${next}`}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
          >
            Next
          </Link>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              if (isValidPostDate(v)) router.push(`/blog/${v}`);
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            aria-label="Jump to date"
          />
          {date === todayDate ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--canvas)]"
            >
              Open live Today
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RegenerateDayButton date={date} hasAiSummary={hasAiSummary} />
        {postId ? (
          <PublishToggle postId={postId} initialPublic={Boolean(isPublic)} />
        ) : null}
      </div>
    </div>
  );
}
