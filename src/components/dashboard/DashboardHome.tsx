"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Layout } from "react-grid-layout";
import { createClient } from "@/lib/supabase/client";
import type { Dashboard, DashboardPanel, Profile } from "@/lib/database.types";
import { PANEL_META, type PanelConfig, type PanelType } from "@/lib/panels/types";
import { timeOfDayGreeting } from "@/lib/utils/greeting";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { DashboardHeaderMeta } from "@/components/dashboard/DashboardHeaderMeta";
import { useDashboardActions } from "@/components/dashboard/DashboardActionsContext";
import { useToast } from "@/components/ui/Toast";

export function DashboardHome({
  userId,
  initialProfile,
  initialDashboards,
  initialPanels,
}: {
  userId: string;
  initialProfile: Profile | null;
  initialDashboards: Dashboard[];
  initialPanels: DashboardPanel[];
}) {
  const router = useRouter();
  const showToast = useToast((s) => s.show);
  const { registerAddPanel } = useDashboardActions();
  const supabase = useMemo(() => createClient(), []);
  const [dashboards, setDashboards] = useState(initialDashboards);
  const [activeId, setActiveId] = useState(
    initialDashboards.find((d) => d.is_default)?.id ??
      initialDashboards[0]?.id ??
      null,
  );
  const [panels, setPanels] = useState(initialPanels);

  useEffect(() => {
    if (!initialProfile?.onboarding_completed && dashboards.length === 0) {
      router.replace("/onboarding");
    }
  }, [initialProfile, dashboards.length, router]);

  useEffect(() => {
    if (!activeId) return;
    void (async () => {
      const { data } = await supabase
        .from("dashboard_panels")
        .select("*")
        .eq("dashboard_id", activeId)
        .order("y", { ascending: true });
      setPanels(data ?? []);
    })();
  }, [activeId, supabase]);

  const persistLayout = useCallback(
    async (layout: Layout) => {
      setPanels((prev) =>
        prev.map((p) => {
          const item = layout.find((l) => l.i === p.id);
          if (!item) return p;
          return { ...p, x: item.x, y: item.y, w: item.w, h: item.h };
        }),
      );

      await Promise.all(
        layout.map((item) =>
          supabase
            .from("dashboard_panels")
            .update({
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.i),
        ),
      );
    },
    [supabase],
  );

  const debouncedPersist = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (layout: Layout) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void persistLayout(layout);
      }, 400);
    };
  }, [persistLayout]);

  const addPanel = useCallback(
    async (type: PanelType) => {
      if (!activeId) return;
      const meta = PANEL_META[type];
      const maxY = panels.reduce((acc, p) => Math.max(acc, p.y + p.h), 0);
      const { data, error } = await supabase
        .from("dashboard_panels")
        .insert({
          dashboard_id: activeId,
          user_id: userId,
          panel_type: type,
          x: 0,
          y: maxY,
          w: meta.defaultW,
          h: meta.defaultH,
          config: {},
        })
        .select()
        .single();

      if (error || !data) {
        showToast(error?.message ?? "Could not add panel");
        return;
      }
      setPanels((prev) => [...prev, data]);
      showToast(`${meta.label} added`);
    },
    [activeId, panels, showToast, supabase, userId],
  );

  useEffect(() => {
    registerAddPanel(addPanel);
    return () => registerAddPanel(null);
  }, [addPanel, registerAddPanel]);

  async function removePanel(panelId: string) {
    const { error } = await supabase
      .from("dashboard_panels")
      .delete()
      .eq("id", panelId);
    if (error) {
      showToast(error.message);
      return;
    }
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
  }

  async function updateConfig(panelId: string, config: PanelConfig) {
    const { error } = await supabase
      .from("dashboard_panels")
      .update({ config, updated_at: new Date().toISOString() })
      .eq("id", panelId);
    if (error) {
      showToast(error.message);
      return;
    }
    setPanels((prev) =>
      prev.map((p) => (p.id === panelId ? { ...p, config } : p)),
    );
    showToast("Panel updated");
  }

  async function swapPanel(panelId: string, type: PanelType) {
    const current = panels.find((p) => p.id === panelId);
    if (!current) {
      showToast("Panel not found");
      return;
    }
    if (current.panel_type === type) {
      showToast("Already that panel");
      return;
    }

    const previous = current;
    setPanels((prev) =>
      prev.map((p) =>
        p.id === panelId ? { ...p, panel_type: type, config: {} } : p,
      ),
    );

    const { data, error } = await supabase
      .from("dashboard_panels")
      .update({
        panel_type: type,
        config: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", panelId)
      .select("id, panel_type")
      .maybeSingle();

    if (error || !data) {
      setPanels((prev) =>
        prev.map((p) => (p.id === panelId ? previous : p)),
      );
      showToast(error?.message ?? "Could not swap panel");
      return;
    }

    showToast(`Swapped to ${PANEL_META[type].label}`);
  }

  const firstName =
    initialProfile?.display_name?.split(" ")[0] ??
    "there";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8 hidden flex-col items-start gap-4 md:flex md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="min-w-0 md:flex-1">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight md:text-5xl">
            {timeOfDayGreeting()}, {firstName}
          </h1>
          <DashboardHeaderMeta
            variant="inline"
            location={initialProfile?.location}
            timezone={initialProfile?.timezone}
          />
        </div>

        {dashboards.length > 1 ? (
          <select
            value={activeId ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex flex-col">
        <div className="order-2 md:order-1">
          <DashboardGrid
            userId={userId}
            location={initialProfile?.location ?? null}
            panels={panels}
            onLayoutChange={debouncedPersist}
            onRemovePanel={(id) => void removePanel(id)}
            onUpdateConfig={(id, config) => void updateConfig(id, config)}
            onSwapPanel={(id, type) => void swapPanel(id, type)}
          />
        </div>

        <div className="order-1 mb-10 md:order-2 md:mb-0 md:mt-10">
          <QuickCapture userId={userId} />
        </div>
      </div>
    </main>
  );
}
