"use client";

import { create } from "zustand";

export type CaptureDraftMeta = {
  reflectionPromptId?: string;
};

type CaptureDraftState = {
  pendingText: string | null;
  meta: CaptureDraftMeta | null;
  /** Increments on each successful capture so panels can react. */
  captureSuccessTick: number;
  lastReflectionPromptId: string | null;
  inject: (text: string, meta?: CaptureDraftMeta) => void;
  consumeDraft: () => { text: string; meta: CaptureDraftMeta | null } | null;
  notifyCaptureSuccess: () => void;
};

export const useCaptureDraft = create<CaptureDraftState>((set, get) => ({
  pendingText: null,
  meta: null,
  captureSuccessTick: 0,
  lastReflectionPromptId: null,
  inject: (text, meta) =>
    set({
      pendingText: text,
      meta: meta ?? null,
      lastReflectionPromptId: meta?.reflectionPromptId ?? null,
    }),
  consumeDraft: () => {
    const { pendingText, meta } = get();
    if (pendingText == null) return null;
    set({ pendingText: null, meta: null });
    return { text: pendingText, meta };
  },
  notifyCaptureSuccess: () =>
    set((state) => ({
      captureSuccessTick: state.captureSuccessTick + 1,
    })),
}));
