"use client";

import { create } from "zustand";
import { playUiSound } from "@/lib/sounds/play";

type ToastOptions = {
  variant?: "info" | "error";
};

type ToastState = {
  message: string | null;
  show: (message: string, options?: ToastOptions) => void;
  clear: () => void;
};

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message, options) => {
    set({ message });
    if (options?.variant === "error") {
      playUiSound("error");
    }
    window.setTimeout(() => set({ message: null }), 2800);
  },
  clear: () => set({ message: null }),
}));

export function ToastHost() {
  const message = useToast((s) => s.message);
  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--canvas)] shadow-lg animate-fade-up"
    >
      {message}
    </div>
  );
}
