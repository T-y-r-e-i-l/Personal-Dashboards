"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

export function QuickCapture({ userId }: { userId: string }) {
  const [content, setContent] = useState("");
  const [success, setSuccess] = useState(false);
  const showToast = useToast((s) => s.show);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const recent = useQuery({
    queryKey: ["captures", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captures")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const capture = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("captures").insert({
        user_id: userId,
        content: text,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setContent("");
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 600);
      showToast("Captured");
      await queryClient.invalidateQueries({ queryKey: ["captures", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    capture.mutate(trimmed);
  }

  return (
    <section className="w-full">
      <form onSubmit={onSubmit}>
        <div
          className={`rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ${
            success ? "capture-success" : ""
          }`}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={2}
            placeholder="Capture a thought, task, or note…"
            className="w-full resize-none bg-transparent text-base outline-none placeholder:text-[var(--muted)]"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-[var(--muted)]">⌘/Ctrl + Enter</p>
            <button
              type="submit"
              disabled={capture.isPending || !content.trim()}
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
            >
              Capture
            </button>
          </div>
        </div>
      </form>

      {recent.data && recent.data.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {recent.data.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-4 text-sm text-[var(--muted)]"
            >
              <span className="truncate text-[var(--ink)]">{item.content}</span>
              <time className="shrink-0 text-xs">
                {format(new Date(item.created_at), "MMM d · h:mm a")}
              </time>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
