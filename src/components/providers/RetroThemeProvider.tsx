"use client";

import { useEffect } from "react";

export const RETRO_UI_STORAGE_KEY = "pd-retro-ui";

export function applyRetroTheme(enabled: boolean) {
  if (typeof document === "undefined") return;
  if (enabled) {
    document.documentElement.dataset.theme = "retro";
    window.localStorage.setItem(RETRO_UI_STORAGE_KEY, "1");
  } else {
    delete document.documentElement.dataset.theme;
    window.localStorage.setItem(RETRO_UI_STORAGE_KEY, "0");
  }
}

export function RetroThemeProvider({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    applyRetroTheme(enabled);
    return () => {
      // Leaving the authenticated app — clear theme so public pages stay default.
      delete document.documentElement.dataset.theme;
    };
  }, [enabled]);

  return null;
}
