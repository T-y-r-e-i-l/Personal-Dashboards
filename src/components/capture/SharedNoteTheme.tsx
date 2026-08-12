"use client";

import { useEffect } from "react";

/**
 * Applies the note author's Retro Style on the public shared-note page.
 * Does not touch localStorage — that remains the viewer's app preference.
 */
export function SharedNoteTheme({
  retroUiEnabled,
}: {
  retroUiEnabled: boolean;
}) {
  useEffect(() => {
    if (retroUiEnabled) {
      document.documentElement.dataset.theme = "retro";
    } else {
      delete document.documentElement.dataset.theme;
    }
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [retroUiEnabled]);

  return null;
}
