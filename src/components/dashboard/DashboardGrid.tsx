"use client";

import { useCallback, useMemo, useState } from "react";
import GridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
} from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { DashboardPanel } from "@/lib/database.types";
import type { PanelConfig, PanelType } from "@/lib/panels/types";
import { PANEL_META } from "@/lib/panels/types";
import { PanelChrome } from "@/components/dashboard/PanelChrome";
import { PanelErrorBoundary } from "@/components/dashboard/PanelErrorBoundary";
import { PanelConfigModal } from "@/components/dashboard/PanelConfigModal";
import { TasksPanel } from "@/components/panels/TasksPanel";
import { HabitsPanel } from "@/components/panels/HabitsPanel";
import { MoodPanel } from "@/components/panels/MoodPanel";
import { PrioritiesPanel } from "@/components/panels/PrioritiesPanel";
import { WaterPanel } from "@/components/panels/WaterPanel";
import { WeatherPanel } from "@/components/panels/WeatherPanel";
import { CalendarPanel } from "@/components/panels/CalendarPanel";

function renderPanel(
  type: PanelType,
  userId: string,
  location: string | null,
  config: PanelConfig,
) {
  switch (type) {
    case "tasks":
      return <TasksPanel userId={userId} />;
    case "habits":
      return <HabitsPanel userId={userId} />;
    case "mood":
      return <MoodPanel userId={userId} />;
    case "priorities":
      return <PrioritiesPanel userId={userId} />;
    case "water":
      return <WaterPanel userId={userId} />;
    case "weather":
      return (
        <WeatherPanel
          userId={userId}
          location={config.location || location}
        />
      );
    case "calendar":
      return <CalendarPanel userId={userId} />;
    default:
      return null;
  }
}

export function DashboardGrid({
  userId,
  location,
  panels,
  onLayoutChange,
  onRemovePanel,
  onUpdateConfig,
}: {
  userId: string;
  location: string | null;
  panels: DashboardPanel[];
  onLayoutChange: (layout: Layout) => void;
  onRemovePanel: (panelId: string) => void;
  onUpdateConfig: (panelId: string, config: PanelConfig) => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  const [configPanelId, setConfigPanelId] = useState<string | null>(null);

  const layout: Layout = useMemo(
    () =>
      panels.map((p) => ({
        i: p.id,
        x: p.x,
        y: p.y,
        w: Math.min(12, Math.max(2, p.w)),
        h: Math.max(2, p.h),
        minW: 2,
        minH: 2,
      })),
    [panels],
  );

  const handleLayoutChange = useCallback(
    (next: Layout) => {
      onLayoutChange(next);
    },
    [onLayoutChange],
  );

  const configuring = panels.find((p) => p.id === configPanelId);

  if (panels.length === 0) {
    return (
      <div
        ref={containerRef}
        className="rounded-[24px] border border-dashed border-[var(--border)] px-6 py-16 text-center text-sm text-[var(--muted)]"
      >
        No panels yet. Use Add panel to build your dashboard.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="dashboard-grid w-full">
      {mounted && width > 0 ? (
        <GridLayout
          className="layout"
          width={width}
          layout={layout}
          gridConfig={{
            cols: 12,
            rowHeight: 80,
            margin: [16, 16],
            containerPadding: [0, 0],
          }}
          dragConfig={{
            enabled: true,
            handle: ".panel-drag-handle",
            cancel: "button, input, textarea, select, a",
          }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
        >
          {panels.map((panel) => {
            const type = panel.panel_type as PanelType;
            const config = (panel.config ?? {}) as PanelConfig;
            return (
              <div key={panel.id} className="dashboard-grid-item">
                <div className="panel-drag-handle h-full w-full cursor-grab active:cursor-grabbing">
                  <div className="h-full w-full animate-panel-fade">
                    <PanelChrome
                      panelType={type}
                      onConfigure={() => setConfigPanelId(panel.id)}
                      onRemove={() => onRemovePanel(panel.id)}
                    >
                      <PanelErrorBoundary title={PANEL_META[type]?.label}>
                        {renderPanel(type, userId, location, config)}
                      </PanelErrorBoundary>
                    </PanelChrome>
                  </div>
                </div>
              </div>
            );
          })}
        </GridLayout>
      ) : (
        <div className="h-40" />
      )}

      {configuring ? (
        <PanelConfigModal
          panelType={configuring.panel_type as PanelType}
          initial={(configuring.config ?? {}) as PanelConfig}
          onClose={() => setConfigPanelId(null)}
          onSave={(config) => {
            onUpdateConfig(configuring.id, config);
            setConfigPanelId(null);
          }}
        />
      ) : null}
    </div>
  );
}
