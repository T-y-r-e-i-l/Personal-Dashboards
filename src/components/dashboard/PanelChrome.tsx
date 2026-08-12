"use client";

import { PANEL_META, type PanelType } from "@/lib/panels/types";

export function PanelChrome({
  panelType,
  onConfigure,
  onRemove,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
  children,
}: {
  panelType: PanelType;
  onConfigure?: () => void;
  onRemove?: () => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}) {
  const meta = PANEL_META[panelType];

  return (
    <div
      className={`panel-card group flex flex-col overflow-hidden ${
        collapsible && collapsed ? "h-auto" : "h-full"
      }`}
    >
      <div className="panel-title-bar flex items-center justify-between gap-2 px-4 pt-4">
        <div className="panel-title-stripes" aria-hidden />
        <div className="panel-title-leading relative z-[1] flex min-w-0 flex-1 items-center gap-2">
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className={`panel-close-box panel-chrome-btn shrink-0 rounded-full px-2 py-1 text-xs text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--danger)] ${
                collapsible
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
              aria-label={`Remove ${meta.label}`}
            >
              <span className="panel-close-box-label">Remove</span>
            </button>
          ) : null}
          {collapsible && onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="panel-title-label flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={!collapsed}
            >
              <ChevronIcon expanded={!collapsed} />
              <h3 className="truncate text-sm font-semibold tracking-tight">
                {meta.label}
              </h3>
            </button>
          ) : (
            <h3 className="panel-title-label text-sm font-semibold tracking-tight">
              {meta.label}
            </h3>
          )}
        </div>
        {onConfigure ? (
          <div
            className={`panel-title-actions relative z-[1] flex shrink-0 items-center gap-1 transition ${
              collapsible
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={onConfigure}
              className="panel-settings-btn panel-chrome-btn rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
              aria-label={`Configure ${meta.label}`}
            >
              Settings
            </button>
          </div>
        ) : null}
      </div>
      {collapsible && collapsed ? (
        <div className="px-4 pb-3 pt-1">
          <p className="text-xs text-[var(--muted)]">{meta.description}</p>
        </div>
      ) : (
        <div className="panel-body min-h-0 flex-1 overflow-auto px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 text-[var(--muted)] transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
