"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";

export function GoogleCalendarConnect() {
  const showToast = useToast((s) => s.show);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);

  const status = useQuery({
    queryKey: ["google_calendar_status"],
    queryFn: async () => {
      const res = await fetch("/api/google/status");
      const body = (await res.json()) as {
        connected: boolean;
        email?: string | null;
        configured?: boolean;
        error?: string;
      };
      if (!res.ok && body.error) {
        throw new Error(body.error);
      }
      return body;
    },
  });

  useEffect(() => {
    const google = searchParams.get("google");
    if (google === "connected") {
      showToast("Google Calendar connected");
      void queryClient.invalidateQueries({
        queryKey: ["google_calendar_status"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["google_calendar_events"],
      });
    } else if (google === "error") {
      showToast(
        searchParams.get("message") ?? "Google Calendar connection failed",
      );
    }
  }, [searchParams, showToast, queryClient]);

  async function disconnect() {
    setDisconnecting(true);
    const res = await fetch("/api/google/disconnect", { method: "POST" });
    setDisconnecting(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(body.error ?? "Failed to disconnect");
      return;
    }

    showToast("Google Calendar disconnected");
    await queryClient.invalidateQueries({
      queryKey: ["google_calendar_status"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["google_calendar_events"],
    });
  }

  if (status.isLoading) {
    return (
      <p className="text-sm text-[var(--muted)]">Checking Google Calendar…</p>
    );
  }

  const connected = status.data?.connected;
  const configured = status.data?.configured !== false;

  return (
    <section className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold tracking-tight">Google Calendar</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Sync today&apos;s events into your Calendar panel.
      </p>

      {!configured ? (
        <p className="mt-4 text-sm text-[var(--danger)]">
          Add <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="text-xs">GOOGLE_CLIENT_SECRET</code> to{" "}
          <code className="text-xs">.env.local</code>, then restart the app.
        </p>
      ) : connected ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">Connected</p>
            {status.data?.email ? (
              <p className="text-sm text-[var(--muted)]">{status.data.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={disconnecting}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      ) : (
        <a
          href="/api/google/auth"
          className="mt-4 inline-flex rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--canvas)]"
        >
          Connect Google Calendar
        </a>
      )}
    </section>
  );
}
