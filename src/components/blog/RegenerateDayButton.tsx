"use client";

import { useState } from "react";
import { DigestConfigModal } from "@/components/blog/DigestConfigModal";

export function RegenerateDayButton({
  date,
  hasPost,
}: {
  date: string;
  hasPost: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-soft)]"
      >
        {hasPost ? "Regenerate" : "Generate digest"}
      </button>
      {open ? (
        <DigestConfigModal
          date={date}
          hasPost={hasPost}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
