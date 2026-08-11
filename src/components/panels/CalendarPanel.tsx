"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addHours, endOfDay, format, startOfDay } from "date-fns";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";

type DisplayEvent = {
  id: string;
  title: string;
  starts_at: string;
  all_day: boolean;
  source: "local" | "google";
  html_link?: string;
};

export function CalendarPanel({ userId }: { userId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const showToast = useToast((s) => s.show);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const start = startOfDay(new Date()).toISOString();
  const end = endOfDay(new Date()).toISOString();

  const localEvents = useQuery({
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

  const googleEvents = useQuery({
    queryKey: ["google_calendar_events", start, end],
    queryFn: async () => {
      const res = await fetch(
        `/api/google/events?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Failed to load Google Calendar");
      }
      return (await res.json()) as {
        connected: boolean;
        email?: string | null;
        events: Array<{
          id: string;
          title: string;
          starts_at: string;
          all_day: boolean;
          html_link?: string;
        }>;
      };
    },
    retry: 1,
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

  const merged = useMemo(() => {
    const local: DisplayEvent[] = (localEvents.data ?? []).map((event) => ({
      id: event.id,
      title: event.title,
      starts_at: event.starts_at,
      all_day: event.all_day,
      source: "local" as const,
    }));

    const google: DisplayEvent[] = (googleEvents.data?.events ?? []).map(
      (event) => ({
        id: event.id,
        title: event.title,
        starts_at: event.starts_at,
        all_day: event.all_day,
        source: "google" as const,
        html_link: event.html_link,
      }),
    );

    return [...local, ...google].sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }, [localEvents.data, googleEvents.data]);

  if (localEvents.isLoading && googleEvents.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const googleConnected = googleEvents.data?.connected ?? false;

  if (merged.length === 0 && !adding) {
    return (
      <div className="space-y-3">
        <EmptyState
          message={
            googleConnected
              ? "No events today on Google Calendar or locally."
              : "No events today. Connect Google Calendar or add one."
          }
          actionLabel="Add event"
          onAction={() => setAdding(true)}
        />
        {!googleConnected ? (
          <Link
            href="/settings"
            className="text-xs font-medium text-[var(--accent)]"
          >
            Connect Google Calendar in Settings
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {format(new Date(), "EEEE, MMM d")}
        </p>
        {googleConnected ? (
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
            Google synced
          </p>
        ) : (
          <Link
            href="/settings"
            className="text-[10px] font-medium text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Connect Google
          </Link>
        )}
      </div>

      {googleEvents.isError ? (
        <div className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-xs text-[var(--danger)]">
          <p>
            {googleEvents.error instanceof Error
              ? googleEvents.error.message
              : "Google Calendar unavailable."}
          </p>
          <Link href="/settings" className="font-medium underline">
            Fix in Settings
          </Link>
        </div>
      ) : null}

      <ul className="space-y-2">
        {merged.map((event) => (
          <li
            key={event.id}
            className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{event.title}</p>
              {event.source === "google" ? (
                <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                  Google
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {event.all_day
                ? "All day"
                : format(new Date(event.starts_at), "h:mm a")}
              {event.html_link ? (
                <>
                  {" · "}
                  <a
                    href={event.html_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent)] hover:underline"
                  >
                    Open
                  </a>
                </>
              ) : null}
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
            placeholder="Local event title"
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
          + Add local event
        </button>
      )}
    </div>
  );
}
