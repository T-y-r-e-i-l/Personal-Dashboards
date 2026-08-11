"use client";

import { useRef, useState } from "react";
import type { PanelConfig, PanelType } from "@/lib/panels/types";
import { PANEL_META } from "@/lib/panels/types";
import { HabitsSettingsList } from "@/components/dashboard/HabitsSettingsList";
import { TasksSettingsList } from "@/components/dashboard/TasksSettingsList";
import { resolvePomodoroConfig } from "@/lib/time/pomodoro";
import { useToast } from "@/components/ui/Toast";

const ALL_PANEL_TYPES = Object.keys(PANEL_META) as PanelType[];

export function PanelConfigModal({
  panelType,
  initial,
  userId,
  onClose,
  onSave,
  onSwap,
}: {
  panelType: PanelType;
  initial: PanelConfig;
  userId: string;
  onClose: () => void;
  onSave: (config: PanelConfig) => void;
  onSwap: (type: PanelType) => void;
}) {
  const [config, setConfig] = useState<PanelConfig>(initial);
  const [showSwap, setShowSwap] = useState(false);
  const [saving, setSaving] = useState(false);
  const [swapType, setSwapType] = useState<PanelType>(
    () => ALL_PANEL_TYPES.find((type) => type !== panelType) ?? panelType,
  );
  const tasksSaveRef = useRef<(() => Promise<void>) | null>(null);
  const showToast = useToast((s) => s.show);
  const meta = PANEL_META[panelType];
  const swapOptions = ALL_PANEL_TYPES.filter((type) => type !== panelType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-[var(--surface)] p-6 shadow-xl"
      >
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          {meta.label} settings
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{meta.description}</p>

        <div className="mt-6 space-y-4">
          {panelType === "habits" && (
            <>
              <HabitsSettingsList userId={userId} />
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Default view</span>
                <select
                  value={
                    config.dateRange === "90d"
                      ? "6m"
                      : (config.dateRange ?? "7d")
                  }
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
                  <option value="6m">Last 6 months</option>
                  <option value="1y">Last year</option>
                </select>
              </label>
            </>
          )}

          {panelType === "mood" && (
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
            <>
              <TasksSettingsList userId={userId} saveRef={tasksSaveRef} />
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
            </>
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

          {panelType === "time" && (
            <div className="space-y-3">
              <span className="block text-sm font-medium">Pomodoro lengths</span>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">
                  Focus (minutes)
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={
                    config.pomodoroFocusMin ??
                    resolvePomodoroConfig(config).focusMin
                  }
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      pomodoroFocusMin:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">
                  Short break (minutes)
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={
                    config.pomodoroShortBreakMin ??
                    resolvePomodoroConfig(config).shortBreakMin
                  }
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      pomodoroShortBreakMin:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">
                  Long break (minutes)
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={
                    config.pomodoroLongBreakMin ??
                    resolvePomodoroConfig(config).longBreakMin
                  }
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      pomodoroLongBreakMin:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
                />
              </label>
            </div>
          )}

          {!["habits", "mood", "tasks", "weather", "time"].includes(
            panelType,
          ) && (
            <p className="text-sm text-[var(--muted)]">
              No extra settings for this panel yet. You can still resize it on
              the grid.
            </p>
          )}

          {showSwap ? (
            <div className="border-t border-[var(--border)] pt-4">
              <div className="block text-sm">
                <span className="mb-1.5 block font-medium">Swap with</span>
                <p className="mb-2 text-xs text-[var(--muted)]">
                  Replace this panel in place. Size and position stay the same.
                </p>
                <select
                  value={swapType}
                  onChange={(e) => setSwapType(e.target.value as PanelType)}
                  className="w-full rounded-xl border border-[var(--border)] px-3 py-2"
                >
                  {swapOptions.map((type) => (
                    <option key={type} value={type}>
                      {PANEL_META[type].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex items-center justify-between gap-2">
          {!showSwap ? (
            <button
              type="button"
              onClick={() => setShowSwap(true)}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--surface-soft)]"
            >
              Swap Panel
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full px-4 py-2 text-sm text-[var(--muted)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void (async () => {
                  if (showSwap && swapType !== panelType) {
                    onSwap(swapType);
                    return;
                  }
                  setSaving(true);
                  try {
                    if (panelType === "tasks" && tasksSaveRef.current) {
                      await tasksSaveRef.current();
                    }
                    const next =
                      panelType === "time"
                        ? (() => {
                            const resolved = resolvePomodoroConfig(config);
                            return {
                              ...config,
                              pomodoroFocusMin: resolved.focusMin,
                              pomodoroShortBreakMin: resolved.shortBreakMin,
                              pomodoroLongBreakMin: resolved.longBreakMin,
                            };
                          })()
                        : config;
                    onSave(next);
                  } catch (err) {
                    showToast(
                      err instanceof Error ? err.message : "Could not save",
                    );
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
              className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
