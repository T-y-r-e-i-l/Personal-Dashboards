"use client";

import { useState } from "react";
import type { PanelConfig, PanelType } from "@/lib/panels/types";
import { PANEL_META } from "@/lib/panels/types";

export function PanelConfigModal({
  panelType,
  initial,
  onClose,
  onSave,
}: {
  panelType: PanelType;
  initial: PanelConfig;
  onClose: () => void;
  onSave: (config: PanelConfig) => void;
}) {
  const [config, setConfig] = useState<PanelConfig>(initial);
  const meta = PANEL_META[panelType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-[24px] bg-[var(--surface)] p-6 shadow-xl"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          {meta.label} settings
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{meta.description}</p>

        <div className="mt-6 space-y-4">
          {(panelType === "habits" || panelType === "mood") && (
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Date range</span>
              <select
                value={config.dateRange ?? "7d"}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    dateRange: e.target.value as PanelConfig["dateRange"],
                  }))
                }
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </label>
          )}

          {panelType === "tasks" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.showCompleted ?? true}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    showCompleted: e.target.checked,
                  }))
                }
              />
              Show completed tasks
            </label>
          )}

          {panelType === "weather" && (
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">
                Location override
              </span>
              <input
                value={config.location ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, location: e.target.value }))
                }
                placeholder="City, region"
                className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
              />
            </label>
          )}

          {!["habits", "mood", "tasks", "weather"].includes(panelType) && (
            <p className="text-sm text-[var(--muted)]">
              No extra settings for this panel yet. You can still resize it on
              the grid.
            </p>
          )}
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(config)}
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
