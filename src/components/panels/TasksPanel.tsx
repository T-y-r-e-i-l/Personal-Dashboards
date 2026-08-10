"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export function TasksPanel({ userId }: { userId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const tasks = useQuery({
    queryKey: ["tasks", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "todo" | "done";
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: status === "done" ? "todo" : "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", userId] }),
  });

  const add = useMutation({
    mutationFn: async (taskTitle: string) => {
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: taskTitle,
        due_date: format(new Date(), "yyyy-MM-dd"),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
    },
    onError: (err: Error) => showToast(err.message),
  });

  if (tasks.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const items = tasks.data ?? [];
  if (items.length === 0 && !adding) {
    return (
      <EmptyState
        message="No tasks yet. Add your first one."
        actionLabel="Add task"
        onAction={() => setAdding(true)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((task) => (
          <li key={task.id} className="flex items-start gap-3">
            <button
              type="button"
              aria-label={task.status === "done" ? "Mark incomplete" : "Complete"}
              onClick={() => toggle.mutate({ id: task.id, status: task.status })}
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                task.status === "done"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)]"
              }`}
            >
              {task.status === "done" ? "✓" : ""}
            </button>
            <div className="min-w-0">
              <p
                className={`text-sm ${
                  task.status === "done"
                    ? "text-[var(--muted)] line-through"
                    : "text-[var(--ink)]"
                }`}
              >
                {task.title}
              </p>
              {task.due_date ? (
                <p className="text-xs text-[var(--muted)]">
                  {format(new Date(task.due_date), "MMM d")} · {task.priority}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate(title.trim());
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-medium text-[var(--canvas)]"
          >
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-[var(--accent)]"
        >
          + Add task
        </button>
      )}
    </div>
  );
}
