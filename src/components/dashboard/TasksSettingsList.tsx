"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "@/lib/database.types";

type TasksTab = "todo" | "completed";

const TABS: { value: TasksTab; label: string }[] = [
  { value: "todo", label: "To-Do" },
  { value: "completed", label: "Completed" },
];

function moveItem(items: Task[], fromId: string, toId: string): Task[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function isDone(task: Task) {
  return task.status === "done";
}

export function TasksSettingsList({
  userId,
  saveRef,
}: {
  userId: string;
  saveRef: MutableRefObject<(() => Promise<void>) | null>;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Task[] | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [tab, setTab] = useState<TasksTab>("todo");
  const hydratedKey = useRef<string | null>(null);

  const tasks = useQuery({
    queryKey: ["tasks", userId],
    queryFn: async () => {
      const ordered = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!ordered.error) return ordered.data as Task[];

      if (!/column|schema cache/i.test(ordered.error.message)) {
        throw ordered.error;
      }

      const fallback = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (fallback.error) throw fallback.error;
      return ((fallback.data ?? []) as Task[]).filter(
        (task) => !task.archived_at,
      );
    },
  });

  useEffect(() => {
    if (!tasks.data) return;
    const key = tasks.data
      .map((task) => `${task.id}:${task.sort_order ?? ""}`)
      .join(",");
    if (hydratedKey.current === key) return;
    hydratedKey.current = key;
    setDraft(tasks.data);
    setDeletedIds([]);
  }, [tasks.data]);

  useEffect(() => {
    saveRef.current = async () => {
      const client = createClient();
      const items = draft ?? [];
      const toDelete = deletedIds;

      if (toDelete.length > 0) {
        const { error } = await client
          .from("tasks")
          .delete()
          .in("id", toDelete)
          .eq("user_id", userId);
        if (error) throw error;
      }

      if (items.length > 0) {
        const updates = await Promise.all(
          items.map((task, order) =>
            client
              .from("tasks")
              .update({ sort_order: order + 1 })
              .eq("id", task.id)
              .eq("user_id", userId),
          ),
        );
        const failed = updates.find((result) => result.error)?.error;
        if (failed) {
          if (/column|schema cache/i.test(failed.message)) {
            throw new Error(
              "Run the tasks_sort_order migration in Supabase to enable reordering.",
            );
          }
          throw failed;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
    };

    return () => {
      saveRef.current = null;
    };
  }, [deletedIds, draft, queryClient, saveRef, userId]);

  function clearDragState() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  function reorderInTab(fromId: string, toId: string) {
    setDraft((current) => {
      const items = current ?? [];
      const open = items.filter((task) => !isDone(task));
      const done = items.filter(isDone);
      if (tab === "todo") {
        return [...moveItem(open, fromId, toId), ...done];
      }
      return [...open, ...moveItem(done, fromId, toId)];
    });
  }

  const items = draft ?? [];
  const openItems = useMemo(
    () => items.filter((task) => !isDone(task)),
    [items],
  );
  const doneItems = useMemo(() => items.filter(isDone), [items]);
  const tabItems = tab === "todo" ? openItems : doneItems;
  const displayItems =
    draggingId && dropTargetId && draggingId !== dropTargetId
      ? moveItem(tabItems, draggingId, dropTargetId)
      : tabItems;

  if (tasks.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading tasks…</p>;
  }

  if (tasks.isError) {
    return (
      <p className="text-sm text-[var(--danger)]">
        {tasks.error.message || "Could not load tasks."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="block text-sm font-medium">Your to-dos</span>
        <div
          className="flex shrink-0 rounded-full bg-[var(--surface-soft)] p-0.5"
          role="tablist"
          aria-label="To-do list filter"
        >
          {TABS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={tab === option.value}
              onClick={() => {
                clearDragState();
                setTab(option.value);
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide transition ${
                tab === option.value
                  ? "bg-[var(--ink)] text-[var(--canvas)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No active to-dos.</p>
      ) : tabItems.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {tab === "todo"
            ? "No open to-dos."
            : "No completed to-dos."}
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {displayItems.map((task) => {
            const isDragging = draggingId === task.id;
            const isDropTarget =
              Boolean(draggingId) &&
              dropTargetId === task.id &&
              draggingId !== task.id;

            return (
              <li
                key={task.id}
                onDragOver={(e) => {
                  if (!draggingId || draggingId === task.id) return;
                  e.preventDefault();
                  setDropTargetId(task.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!draggingId) return;
                  const fromId =
                    e.dataTransfer.getData("text/task-id") || draggingId;
                  clearDragState();
                  if (fromId !== task.id) {
                    reorderInTab(fromId, task.id);
                  }
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                  isDropTarget
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)]"
                } ${isDragging ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(task.id);
                    e.dataTransfer.setData("text/task-id", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={clearDragState}
                  className="task-drag-handle cursor-grab px-0.5 text-[var(--muted)] active:cursor-grabbing"
                  aria-label={`Drag to reorder ${task.title}`}
                  title="Drag to reorder"
                >
                  ⋮⋮
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${
                      isDone(task)
                        ? "text-[var(--muted)] line-through"
                        : "text-[var(--ink)]"
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Delete “${task.title}”? This cannot be undone.`,
                      )
                    ) {
                      return;
                    }
                    setDraft((current) =>
                      (current ?? items).filter((row) => row.id !== task.id),
                    );
                    setDeletedIds((ids) =>
                      ids.includes(task.id) ? ids : [...ids, task.id],
                    );
                  }}
                  className="shrink-0 text-xs font-medium text-[var(--danger)] hover:opacity-80"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-[var(--muted)]">
        Drag to reorder. Deletes and order apply when you save.
      </p>
    </div>
  );
}
