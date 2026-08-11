"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Responsive,
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
import { TimeTrackingPanel } from "@/components/panels/TimeTrackingPanel";

const BREAKPOINTS = { lg: 768, xs: 0 } as const;
const COLS = { lg: 12, xs: 1 } as const;
const MOBILE_BREAKPOINT = BREAKPOINTS.lg;

export type WeatherSnapshot = {
  location: string;
  temp: number;
  description: string;
};

function renderPanel(
  type: PanelType,
  userId: string,
  location: string | null,
  config: PanelConfig,
  options: {
    date?: string;
    readOnly?: boolean;
    timeZone?: string;
    weatherSnapshot?: WeatherSnapshot | null;
  },
) {
  const common = {
    userId,
    date: options.date,
    readOnly: options.readOnly,
    timeZone: options.timeZone,
  };
  switch (type) {
    case "tasks":
      return <TasksPanel {...common} />;
    case "habits":
      return <HabitsPanel {...common} config={config} />;
    case "mood":
      return <MoodPanel {...common} config={config} />;
    case "priorities":
      return <PrioritiesPanel {...common} />;
    case "water":
      return <WaterPanel {...common} />;
    case "weather":
      return (
        <WeatherPanel
          {...common}
          location={config.location || location}
          weatherSnapshot={options.weatherSnapshot}
        />
      );
    case "calendar":
      return <CalendarPanel {...common} />;
    case "time":
      return <TimeTrackingPanel {...common} />;
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
  onSwapPanel,
  readOnly = false,
  date,
  timeZone,
  weatherSnapshot,
}: {
  userId: string;
  location: string | null;
  panels: DashboardPanel[];
  onLayoutChange: (layout: Layout) => void;
  onRemovePanel: (panelId: string) => void;
  onUpdateConfig: (panelId: string, config: PanelConfig) => void;
  onSwapPanel: (panelId: string, type: PanelType) => void;
  readOnly?: boolean;
  date?: string;
  timeZone?: string;
  weatherSnapshot?: WeatherSnapshot | null;
}) {
  const { width, containerRef, mounted } = useContainerWidth({
    measureBeforeMount: true,
  });
  const [configPanelId, setConfigPanelId] = useState<string | null>(null);
  const [expandedPanelId, setExpandedPanelId] = useState<string | null>(null);
  const isMobile = mounted && width > 0 && width < MOBILE_BREAKPOINT;

  const panelOptions = useMemo(
    () => ({ date, readOnly, timeZone, weatherSnapshot }),
    [date, readOnly, timeZone, weatherSnapshot],
  );

  const lgLayout: Layout = useMemo(
    () =>
      panels.map((p) => ({
        i: p.id,
        x: p.x,
        y: p.y,
        w: Math.min(12, Math.max(2, p.w)),
        h: Math.max(2, p.h),
        minW: 1,
        minH: 2,
      })),
    [panels],
  );

  const layouts = useMemo(() => ({ lg: lgLayout }), [lgLayout]);

  const mobilePanels = useMemo(
    () =>
      [...panels].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      }),
    [panels],
  );

  const handleLayoutChange = useCallback(
    (_current: Layout, allLayouts: { lg?: Layout; xs?: Layout }) => {
      if (readOnly) return;
      // Never persist the stacked mobile layout back to the database.
      if (width < MOBILE_BREAKPOINT) return;
      if (allLayouts.lg) onLayoutChange(allLayouts.lg);
    },
    [onLayoutChange, readOnly, width],
  );

  function togglePanel(panelId: string) {
    setExpandedPanelId((current) => (current === panelId ? null : panelId));
  }

  const configuring = !readOnly
    ? panels.find((p) => p.id === configPanelId)
    : undefined;

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
      {!mounted || width <= 0 ? (
        <div className="h-40" />
      ) : isMobile ? (
        <div className="space-y-3">
          {mobilePanels.map((panel) => {
            const type = panel.panel_type as PanelType;
            const config = (panel.config ?? {}) as PanelConfig;
            const collapsed = expandedPanelId !== panel.id;
            return (
              <div
                key={panel.id}
                className={collapsed ? undefined : "min-h-[280px]"}
              >
                <PanelChrome
                  key={`${panel.id}-${type}`}
                  panelType={type}
                  collapsible
                  collapsed={collapsed}
                  onToggleCollapse={() => togglePanel(panel.id)}
                  onConfigure={
                    readOnly ? undefined : () => setConfigPanelId(panel.id)
                  }
                  onRemove={
                    readOnly ? undefined : () => onRemovePanel(panel.id)
                  }
                >
                  {!collapsed ? (
                    <PanelErrorBoundary
                      key={type}
                      title={PANEL_META[type]?.label}
                    >
                      {renderPanel(
                        type,
                        userId,
                        location,
                        config,
                        panelOptions,
                      )}
                    </PanelErrorBoundary>
                  ) : null}
                </PanelChrome>
              </div>
            );
          })}
        </div>
      ) : (
        <Responsive
          className="layout"
          width={width}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          layouts={layouts}
          rowHeight={80}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          dragConfig={{
            enabled: !readOnly,
            handle: ".panel-drag-handle",
            cancel:
              "button, input, textarea, select, a, .task-drag-handle, .habit-drag-handle",
          }}
          resizeConfig={{
            enabled: !readOnly,
            handles: ["se"],
          }}
          compactor={verticalCompactor}
          onLayoutChange={handleLayoutChange}
        >
          {panels.map((panel) => {
            const type = panel.panel_type as PanelType;
            const config = (panel.config ?? {}) as PanelConfig;
            return (
              <div key={panel.id} className="dashboard-grid-item">
                <div
                  className={`panel-drag-handle h-full w-full ${
                    readOnly
                      ? "cursor-default"
                      : "cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <div className="h-full w-full animate-panel-fade">
                    <PanelChrome
                      key={`${panel.id}-${type}`}
                      panelType={type}
                      onConfigure={
                        readOnly
                          ? undefined
                          : () => setConfigPanelId(panel.id)
                      }
                      onRemove={
                        readOnly
                          ? undefined
                          : () => onRemovePanel(panel.id)
                      }
                    >
                      <PanelErrorBoundary
                        key={type}
                        title={PANEL_META[type]?.label}
                      >
                        {renderPanel(
                          type,
                          userId,
                          location,
                          config,
                          panelOptions,
                        )}
                      </PanelErrorBoundary>
                    </PanelChrome>
                  </div>
                </div>
              </div>
            );
          })}
        </Responsive>
      )}

      {configuring ? (
        <PanelConfigModal
          panelType={configuring.panel_type as PanelType}
          initial={(configuring.config ?? {}) as PanelConfig}
          userId={userId}
          onClose={() => setConfigPanelId(null)}
          onSave={(config) => {
            onUpdateConfig(configuring.id, config);
            setConfigPanelId(null);
          }}
          onSwap={(type) => {
            onSwapPanel(configuring.id, type);
            setConfigPanelId(null);
          }}
        />
      ) : null}
    </div>
  );
}
