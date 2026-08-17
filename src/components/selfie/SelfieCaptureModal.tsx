"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { optimizeSelfieFromVideo } from "@/lib/selfie/optimize";
import {
  resolveSelfieUrl,
  todaySelfieDate,
  upsertDailySelfie,
  fetchLatestSelfieBefore,
} from "@/lib/selfie/storage";
import { useToast } from "@/components/ui/Toast";

type Phase = "live" | "review";

export function SelfieCaptureModal({
  userId,
  timeZone,
  open,
  onClose,
  onSaved,
}: {
  userId: string;
  timeZone: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const showToast = useToast((s) => s.show);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("live");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [onionUrl, setOnionUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setPhase("live");
    setPreviewUrl(null);
    setError(null);

    async function start() {
      try {
        const supabase = createClient();
        const today = todaySelfieDate(timeZone);
        const prev = await fetchLatestSelfieBefore(supabase, userId, today);
        if (prev && !cancelled) {
          const url = await resolveSelfieUrl(supabase, prev.storage_path);
          if (!cancelled) setOnionUrl(url);
        } else if (!cancelled) {
          setOnionUrl(null);
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission denied. Enable it in your browser settings."
            : err instanceof Error
              ? err.message
              : "Could not open camera";
        setError(message);
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, timeZone, userId]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function onCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const blob = await optimizeSelfieFromVideo(video);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setPhase("review");
      stopStream();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not capture");
    }
  }

  async function onRetake() {
    setPhase("live");
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reopen camera",
      );
    }
  }

  async function onSubmit() {
    if (!previewUrl) return;
    setSubmitting(true);
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const supabase = createClient();
      await upsertDailySelfie(supabase, {
        userId,
        selfieDate: todaySelfieDate(timeZone),
        blob,
      });
      showToast("Selfie saved");
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save selfie");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ink)]/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Daily selfie"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              Daily selfie
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Align with your last selfie’s ghost, then capture.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="relative mx-auto mt-4 aspect-square w-full max-w-sm overflow-hidden rounded-full border border-[var(--border)] bg-[var(--canvas)]">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full scale-x-[-1] object-cover ${
              phase === "live" ? "block" : "hidden"
            }`}
          />
          {phase === "live" && onionUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={onionUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover opacity-35"
            />
          ) : null}
          {phase === "review" && previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Selfie preview"
              className="h-full w-full scale-x-[-1] object-cover"
            />
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {phase === "live" ? (
            <button
              type="button"
              onClick={() => void onCapture()}
              disabled={Boolean(error)}
              className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
            >
              Capture
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void onRetake()}
                disabled={submitting}
                className="rounded-full px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={() => void onSubmit()}
                disabled={submitting}
                className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Use photo"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
