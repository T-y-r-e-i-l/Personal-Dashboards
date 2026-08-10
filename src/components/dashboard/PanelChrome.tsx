"use client";

import { PANEL_META, type PanelType } from "@/lib/panels/types";

export function PanelChrome({
  panelType,
  onConfigure,
  onRemove,
  children,
}: {
  panelType: PanelType;
  onConfigure?: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
}) {
  const meta = PANEL_META[panelType];

  return (
    <div className="panel-card group flex h-full flex-col overflow-hidden animate-panel-settle">
      <div className="flex items-center justify-between px-4 pt-4">
        <h3 className="text-sm font-semibold tracking-tight">{meta.label}</h3>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {onConfigure ? (
            <button
              type="button"
              onClick={onConfigure}
              className="rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              aria-label={`Configure ${meta.label}`}
            >
              Settings
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--danger)]"
              aria-label={`Remove ${meta.label}`}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-3">{children}</div>
    </div>
  );
}
