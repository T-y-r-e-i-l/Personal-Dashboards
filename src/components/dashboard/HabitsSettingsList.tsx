"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Habit } from "@/lib/database.types";
import { useToast } from "@/components/ui/Toast";

function moveItem(items: Habit[], fromId: string, toId: string): Habit[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function HabitsSettingsList({ userId }: { userId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const habits = useQuery({
    queryKey: ["habits", userId],
    queryFn: async () => {
      const ordered = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (!ordered.error) return ordered.data;

      if (!/column|schema cache/i.test(ordered.error.message)) {
        throw ordered.error;
      }
      const fallback = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (fallback.error) throw fallback.error;
      return fallback.data;
    },
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("habits")
        .update({ name })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditingId(null);
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["habits", userId] });
      showToast("Habit renamed");
    },
    onError: (err: Error) => showToast(err.message),
  });

  const add = useMutation({
    mutationFn: async (name: string) => {
      const existing = habits.data ?? [];
      const nextOrder =
        existing.reduce(
          (max, habit) =>
            Math.max(
              max,
              typeof habit.sort_order === "number" ? habit.sort_order : 0,
            ),
          0,
        ) + 1;
      const withOrder = await supabase.from("habits").insert({
        user_id: userId,
        name,
        sort_order: nextOrder,
      });
      if (!withOrder.error) return;

      if (!/column|schema cache/i.test(withOrder.error.message)) {
        throw withOrder.error;
      }
      const basic = await supabase.from("habits").insert({
        user_id: userId,
        name,
      });
      if (basic.error) throw basic.error;
    },
    onSuccess: async () => {
      setNewName("");
      setAdding(false);
      await queryClient.invalidateQueries({ queryKey: ["habits", userId] });
      showToast("Habit added");
    },
    onError: (err: Error) => showToast(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("habits")
        .update({ active: false })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (editingId) {
        setEditingId(null);
        setDraft("");
      }
      await queryClient.invalidateQueries({ queryKey: ["habits", userId] });
      showToast("Habit removed");
    },
    onError: (err: Error) => showToast(err.message),
  });

  const reorder = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      const items = habits.data ?? [];
      const reordered = moveItem(items, fromId, toId);
      if (reordered === items) return;

      const updates = await Promise.all(
        reordered.map((habit, order) =>
          supabase
            .from("habits")
            .update({ sort_order: order + 1 })
            .eq("id", habit.id)
            .eq("user_id", userId),
        ),
      );
      const failed = updates.find((result) => result.error)?.error;
      if (failed) throw failed;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["habits", userId] });
    },
    onError: (err: Error) => {
      if (/column|schema cache/i.test(err.message)) {
        showToast(
          "Run the habits_sort_order migration in Supabase to enable reordering.",
        );
        return;
      }
      showToast(err.message);
    },
  });

  function clearDragState() {
    setDraggingId(null);
    setDropTargetId(null);
  }

  if (habits.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading habits…</p>;
  }

  if (habits.isError) {
    return (
      <p className="text-sm text-[var(--danger)]">
        {habits.error.message || "Could not load habits."}
      </p>
    );
  }

  const items = habits.data ?? [];
  const displayItems =
    draggingId && dropTargetId && draggingId !== dropTargetId
      ? moveItem(items, draggingId, dropTargetId)
      : items;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">Your habits</span>
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {displayItems.map((habit) => {
          const isEditing = editingId === habit.id;
          const isDragging = draggingId === habit.id;
          const isDropTarget =
            Boolean(draggingId) &&
            dropTargetId === habit.id &&
            draggingId !== habit.id;

          return (
            <li
              key={habit.id}
              onDragOver={(e) => {
                if (!draggingId || draggingId === habit.id) return;
                e.preventDefault();
                setDropTargetId(habit.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!draggingId) return;
                const fromId =
                  e.dataTransfer.getData("text/habit-id") || draggingId;
                clearDragState();
                if (fromId !== habit.id) {
                  reorder.mutate({ fromId, toId: habit.id });
                }
              }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                isDropTarget
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--border)]"
              } ${isDragging ? "opacity-50" : ""}`}
            >
              {!isEditing ? (
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(habit.id);
                    e.dataTransfer.setData("text/habit-id", habit.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={clearDragState}
                  className="habit-drag-handle cursor-grab px-0.5 text-[var(--muted)] active:cursor-grabbing"
                  aria-label={`Drag to reorder ${habit.name}`}
                  title="Drag to reorder"
                >
                  ⋮⋮
                </button>
              ) : null}

              {isEditing ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = draft.trim();
                    if (!name || name === habit.name) {
                      setEditingId(null);
                      setDraft("");
                      return;
                    }
                    rename.mutate({ id: habit.id, name });
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-2 py-1.5 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    disabled={rename.isPending}
                    className="shrink-0 text-xs font-medium text-[var(--accent)]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setDraft("");
                    }}
                    className="shrink-0 text-xs text-[var(--muted)]"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {habit.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setEditingId(habit.id);
                      setDraft(habit.name);
                    }}
                    className="shrink-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove “${habit.name}”? Past logs stay in history.`,
                        )
                      ) {
                        remove.mutate(habit.id);
                      }
                    }}
                    className="shrink-0 text-xs font-medium text-[var(--danger)] hover:opacity-80"
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          );
        })}

        {adding ? (
          <li className="rounded-xl border border-[var(--border)] px-3 py-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newName.trim();
                if (!name) return;
                add.mutate(name);
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Habit name"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--canvas)] px-2 py-1.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={add.isPending}
                className="shrink-0 text-xs font-medium text-[var(--accent)]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
                className="shrink-0 text-xs text-[var(--muted)]"
              >
                Cancel
              </button>
            </form>
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={() => {
          setEditingId(null);
          setDraft("");
          setAdding(true);
        }}
        className="text-xs font-medium text-[var(--accent)] hover:opacity-80"
      >
        + Add Habit
      </button>
    </div>
  );
}
