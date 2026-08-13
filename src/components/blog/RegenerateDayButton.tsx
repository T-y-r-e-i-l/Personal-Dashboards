"use client";

import { useState } from "react";
import { DigestConfigModal } from "@/components/blog/DigestConfigModal";

export function RegenerateDayButton({
  date,
  hasAiSummary,
}: {
  date: string;
  hasAiSummary: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-soft)]"
      >
        {hasAiSummary ? "Regenerate AI summary" : "AI summary"}
      </button>
      {open ? (
        <DigestConfigModal
          date={date}
          hasAiSummary={hasAiSummary}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
