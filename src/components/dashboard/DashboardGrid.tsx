"use client";

import { useCallback, useMemo, useState } from "react";
import GridLayout, {
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
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
      return <WeatherPanel location={config.location || location} />;
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
  const { width, containerRef, mounted } = useContainerWidth();
  const [configPanelId, setConfigPanelId] = useState<string | null>(null);

  const layout: Layout = useMemo(
    () =>
      panels.map((p) => ({
        i: p.id,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
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
    <div ref={containerRef} className="w-full">
      {mounted && width > 0 ? (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: width < 768 ? 4 : width < 1200 ? 8 : 12,
            rowHeight: 72,
            margin: [16, 16],
            containerPadding: [0, 0],
          }}
          dragConfig={{ enabled: true, handle: ".panel-drag-handle" }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
        >
          {panels.map((panel, index) => {
            const type = panel.panel_type as PanelType;
            const config = (panel.config ?? {}) as PanelConfig;
            return (
              <div
                key={panel.id}
                className="animate-panel-settle"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="panel-drag-handle h-full cursor-grab active:cursor-grabbing">
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
