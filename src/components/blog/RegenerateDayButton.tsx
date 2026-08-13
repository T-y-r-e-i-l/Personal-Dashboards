"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export function RegenerateDayButton({
  date,
  hasPost,
}: {
  date: string;
  hasPost: boolean;
}) {
  const [pending, setPending] = useState(false);
  const showToast = useToast((s) => s.show);
  const router = useRouter();

  async function onClick() {
    if (hasPost) {
      const ok = window.confirm(
        "Replace this day’s digest? Public/private stays the same.",
      );
      if (!ok) return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/blog/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        created?: boolean;
        updated?: boolean;
        error?: string;
        reason?: string;
      };

      if (!res.ok || !data.ok) {
        showToast(data.error || "Could not generate digest.");
        return;
      }

      showToast(
        data.updated
          ? "Digest regenerated"
          : data.created
            ? "Digest generated"
            : "Done",
      );
      router.refresh();
    } catch {
      showToast("Could not generate digest.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={pending}
      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
    >
      {pending
        ? hasPost
          ? "Regenerating…"
          : "Generating…"
        : hasPost
          ? "Regenerate"
          : "Generate digest"}
    </button>
  );
}
