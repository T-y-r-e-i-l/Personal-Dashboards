"use client";

import { PANEL_META, type PanelType } from "@/lib/panels/types";

export function AddPanelMenu({
  onSelect,
  onClose,
}: {
  onSelect: (type: PanelType) => void;
  onClose?: () => void;
}) {
  return (
    <div className="w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
      {(Object.keys(PANEL_META) as PanelType[]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => {
            onSelect(type);
            onClose?.();
          }}
          className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--surface-soft)]"
        >
          {PANEL_META[type].label}
        </button>
      ))}
    </div>
  );
}
