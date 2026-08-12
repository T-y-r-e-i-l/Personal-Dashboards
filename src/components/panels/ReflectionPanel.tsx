"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useCaptureDraft } from "@/components/capture/captureDraftStore";
import {
  advanceAfterCapture,
  createInitialDayState,
  defaultPromptForDay,
  MAX_REFLECTION_SKIPS,
  normalizeDayState,
  reflectionStorageKey,
  remainingSkips,
  skipCurrentPrompt,
  type ReflectionDayState,
} from "@/lib/reflection/daily";
import { getPromptById } from "@/lib/reflection/prompts";

function readDayState(userId: string, day: string): ReflectionDayState {
  if (typeof window === "undefined") return createInitialDayState(day);
  try {
    const raw = window.localStorage.getItem(reflectionStorageKey(userId, day));
    return normalizeDayState(raw ? JSON.parse(raw) : null, day);
  } catch {
    return createInitialDayState(day);
  }
}

function writeDayState(
  userId: string,
  day: string,
  state: ReflectionDayState,
) {
  window.localStorage.setItem(
    reflectionStorageKey(userId, day),
    JSON.stringify(state),
  );
}

export function ReflectionPanel({
  userId,
  date,
  readOnly = false,
}: {
  userId: string;
  date?: string;
  readOnly?: boolean;
}) {
  const day = date ?? format(new Date(), "yyyy-MM-dd");
  const interactive = !readOnly && !date;
  const [state, setState] = useState<ReflectionDayState>(() =>
    createInitialDayState(day),
  );
  const [hydrated, setHydrated] = useState(false);
  const inject = useCaptureDraft((s) => s.inject);
  const captureSuccessTick = useCaptureDraft((s) => s.captureSuccessTick);
  const lastTickRef = useRef(captureSuccessTick);

  useEffect(() => {
    if (!interactive) return;
    setState(readDayState(userId, day));
    lastTickRef.current = useCaptureDraft.getState().captureSuccessTick;
    setHydrated(true);
  }, [userId, day, interactive]);

  useEffect(() => {
    if (!interactive || !hydrated) return;
    writeDayState(userId, day, state);
  }, [state, userId, day, interactive, hydrated]);

  useEffect(() => {
    if (!interactive || !hydrated) return;
    if (captureSuccessTick === lastTickRef.current) return;
    lastTickRef.current = captureSuccessTick;
    setState((current) => {
      if (!current.awaitingCapture) return current;
      return advanceAfterCapture(current);
    });
  }, [captureSuccessTick, interactive, hydrated]);

  if (!interactive) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Reflection prompts are available on Today.
      </p>
    );
  }

  const prompt =
    getPromptById(state.promptId) ?? defaultPromptForDay(day);
  const promptText = prompt.text;
  const skipsLeft = remainingSkips(state.skipsUsed);

  function onInject() {
    const text = promptText.trim();
    if (!text) return;
    inject(`# ${text}\n\n`, { reflectionPromptId: state.promptId });
    setState((current) => ({ ...current, awaitingCapture: true }));
  }

  function onSkip(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState((current) => {
      const next = skipCurrentPrompt(current);
      return next ?? current;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        type="button"
        onClick={onInject}
        className="flex min-h-0 flex-1 flex-col items-start justify-center rounded-2xl text-left outline-none transition hover:bg-[var(--surface-soft)]/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        title="Add prompt to capture"
      >
        <p className="font-[family-name:var(--font-display)] text-xl leading-snug text-[var(--ink)] md:text-2xl">
          {promptText}
        </p>
        <span className="mt-3 text-xs text-[var(--muted)]">
          Tap to reflect in capture
        </span>
      </button>

      <div className="mt-3 flex flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={onSkip}
          disabled={skipsLeft <= 0}
          className="reflection-skip flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={
            skipsLeft > 0
              ? `Skip prompt (${skipsLeft} left today)`
              : "No skips left today"
          }
          title={
            skipsLeft > 0
              ? `Skip (${skipsLeft} left today)`
              : "No skips left today"
          }
        >
          <RefreshIcon />
        </button>
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: MAX_REFLECTION_SKIPS }, (_, index) => {
            const used = index < state.skipsUsed;
            return (
              <span
                key={index}
                className={`h-1.5 w-1.5 rounded-full ${
                  used
                    ? "border border-[var(--muted)] bg-transparent"
                    : "bg-[var(--ink)]"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 0-14.5-7.1L4 7" />
      <path d="M4 3v4h4" />
      <path d="M3 12a9 9 0 0 0 14.5 7.1L20 17" />
      <path d="M20 21v-4h-4" />
    </svg>
  );
}
