"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SelfieCaptureModal } from "@/components/selfie/SelfieCaptureModal";
import {
  fetchSelfieForDate,
  resolveSelfieUrl,
  todaySelfieDate,
} from "@/lib/selfie/storage";

export function DailySelfieButton({
  userId,
  timeZone,
}: {
  userId: string;
  timeZone: string;
}) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const selfieDate = todaySelfieDate(timeZone);

  const today = useQuery({
    queryKey: ["daily-selfie", userId, selfieDate],
    queryFn: async () => {
      const row = await fetchSelfieForDate(supabase, userId, selfieDate);
      if (!row) return null;
      const url = await resolveSelfieUrl(supabase, row.storage_path);
      return url ? { row, url } : null;
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-soft)] shadow-[var(--shadow-soft)] outline-none transition hover:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:h-[4.5rem] md:w-[4.5rem]"
        title={today.data ? "Retake today’s selfie" : "Take today’s selfie"}
        aria-label={today.data ? "Retake today’s selfie" : "Take today’s selfie"}
      >
        {today.data?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={today.data.url}
            alt=""
            className="h-full w-full scale-x-[-1] object-cover"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[var(--muted)]">
            <CameraIcon />
            <span className="text-[10px] font-medium">Selfie</span>
          </span>
        )}
      </button>

      <SelfieCaptureModal
        userId={userId}
        timeZone={timeZone}
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          void queryClient.invalidateQueries({
            queryKey: ["daily-selfie", userId, selfieDate],
          });
          void queryClient.invalidateQueries({
            queryKey: ["daily-selfie-timelapse", userId],
          });
        }}
      />
    </>
  );
}

function CameraIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8h3l2-2h6l2 2h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
