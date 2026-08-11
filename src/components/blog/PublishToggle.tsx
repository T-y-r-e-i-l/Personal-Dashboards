"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

export function PublishToggle({
  postId,
  initialPublic,
}: {
  postId: string;
  initialPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [pending, setPending] = useState(false);
  const showToast = useToast((s) => s.show);
  const router = useRouter();

  async function toggle() {
    setPending(true);
    const next = !isPublic;
    const supabase = createClient();
    const { error } = await supabase
      .from("blog_posts")
      .update({ is_public: next })
      .eq("id", postId);

    setPending(false);
    if (error) {
      showToast(error.message);
      return;
    }

    setIsPublic(next);
    showToast(next ? "Post published" : "Post unpublished");
    router.refresh();
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Public link copied");
    } catch {
      showToast(url);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={pending}
        className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
          isPublic
            ? "border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]"
            : "bg-[var(--ink)] text-[var(--canvas)]"
        }`}
      >
        {pending ? "Saving…" : isPublic ? "Unpublish" : "Publish"}
      </button>
      {isPublic ? (
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Copy public link
        </button>
      ) : null}
    </div>
  );
}
