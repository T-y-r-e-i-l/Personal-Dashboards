"use client";

import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

type GoogleEvent = {
  id: string;
  title: string;
  starts_at: string;
  all_day: boolean;
  html_link?: string;
};

export function CalendarPanel({ userId: _userId }: { userId: string }) {
  const router = useRouter();
  const start = startOfDay(new Date()).toISOString();
  const end = endOfDay(new Date()).toISOString();

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
        events: GoogleEvent[];
      };
    },
    retry: 1,
  });

  if (googleEvents.isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const connected = googleEvents.data?.connected ?? false;
  const events = googleEvents.data?.events ?? [];

  if (googleEvents.isError) {
    return (
      <div className="space-y-2">
        <EmptyState
          message={
            googleEvents.error instanceof Error
              ? googleEvents.error.message
              : "Google Calendar unavailable."
          }
          actionLabel="Open Settings"
          onAction={() => router.push("/settings")}
        />
      </div>
    );
  }

  if (!connected) {
    return (
      <EmptyState
        message="Connect Google Calendar in Settings to see today’s events."
        actionLabel="Open Settings"
        onAction={() => router.push("/settings")}
      />
    );
  }

  if (events.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--muted)]">
            {format(new Date(), "EEEE, MMM d")}
          </p>
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
            Google synced
          </p>
        </div>
        <EmptyState message="No Google Calendar events today." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {format(new Date(), "EEEE, MMM d")}
        </p>
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--accent)]">
          Google synced
        </p>
      </div>

      <ul className="space-y-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-xl bg-[var(--surface-soft)] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-medium">{event.title}</p>
              <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                Google
              </span>
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

      <Link
        href="/settings"
        className="text-xs font-medium text-[var(--muted)] hover:text-[var(--accent)]"
      >
        Manage Google Calendar
      </Link>
    </div>
  );
}
