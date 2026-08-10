"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHours, endOfDay, format, startOfDay } from "date-fns";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

export function CalendarPanel({ userId }: { userId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const start = startOfDay(new Date()).toISOString();
  const end = endOfDay(new Date()).toISOString();

  const events = useQuery({
    queryKey: ["calendar_events", userId, start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", userId)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const starts = new Date();
      const { error } = await supabase.from("calendar_events").insert({
        user_id: userId,
        title: title.trim(),
        starts_at: starts.toISOString(),
        ends_at: addHours(starts, 1).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setTitle("");
      setAdding(false);
      await queryClient.invalidateQueries({
        queryKey: ["calendar_events", userId, start],
      });
    },
    onError: (err: Error) => showToast(err.message),
  });

  if (events.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const data = events.data ?? [];

  if (data.length === 0 && !adding) {
    return (
      <EmptyState
        message="No events today. Add one to fill your calendar."
        actionLabel="Add event"
        onAction={() => setAdding(true)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        {format(new Date(), "EEEE, MMM d")}
      </p>
      <ul className="space-y-2">
        {data.map((event) => (
          <li
            key={event.id}
            className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"
          >
            <p className="text-sm font-medium">{event.title}</p>
            <p className="text-xs text-[var(--muted)]">
              {event.all_day
                ? "All day"
                : format(new Date(event.starts_at), "h:mm a")}
            </p>
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
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
          + Add event
        </button>
      )}
    </div>
  );
}
