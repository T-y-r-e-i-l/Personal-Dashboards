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
import { DailySelfieButton } from "@/components/selfie/DailySelfieButton";
import { useToast } from "@/components/ui/Toast";
import { getDayRange } from "@/lib/blog/dayRange";
import {
  ensureLayoutSnapshot,
  upsertLayoutSnapshot,
} from "@/lib/dashboard/layoutSnapshot";

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
  const timeZone = initialProfile?.timezone ?? "America/Los_Angeles";
  const defaultDashboardId =
    dashboards.find((d) => d.is_default)?.id ?? dashboards[0]?.id ?? null;

  const snapshotToday = useCallback(
    async (
      nextPanels: DashboardPanel[],
      mode: "ensure" | "upsert" = "upsert",
    ) => {
      if (!defaultDashboardId) return;
      const snapshotDate = getDayRange(timeZone).postDate;
      const opts = {
        userId,
        dashboardId: defaultDashboardId,
        snapshotDate,
        panels: nextPanels,
      };
      if (mode === "ensure") {
        await ensureLayoutSnapshot(supabase, opts);
      } else {
        await upsertLayoutSnapshot(supabase, opts);
      }
    },
    [defaultDashboardId, supabase, timeZone, userId],
  );

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
      const next = data ?? [];
      setPanels(next);
      if (activeId === defaultDashboardId) {
        await snapshotToday(next, "ensure");
      }
    })();
  }, [activeId, defaultDashboardId, snapshotToday, supabase]);

  const persistLayout = useCallback(
    async (layout: Layout) => {
      const nextPanels = panels.map((p) => {
        const item = layout.find((l) => l.i === p.id);
        if (!item) return p;
        return { ...p, x: item.x, y: item.y, w: item.w, h: item.h };
      });
      setPanels(nextPanels);

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
      if (activeId === defaultDashboardId) {
        await snapshotToday(nextPanels, "upsert");
      }
    },
    [activeId, defaultDashboardId, panels, snapshotToday, supabase],
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
      const nextPanels = [...panels, data];
      setPanels(nextPanels);
      if (activeId === defaultDashboardId) {
        await snapshotToday(nextPanels, "upsert");
      }
      showToast(`${meta.label} added`);
    },
    [
      activeId,
      defaultDashboardId,
      panels,
      showToast,
      snapshotToday,
      supabase,
      userId,
    ],
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
    const nextPanels = panels.filter((p) => p.id !== panelId);
    setPanels(nextPanels);
    if (activeId === defaultDashboardId) {
      await snapshotToday(nextPanels, "upsert");
    }
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
    const nextPanels = panels.map((p) =>
      p.id === panelId ? { ...p, config } : p,
    );
    setPanels(nextPanels);
    if (activeId === defaultDashboardId) {
      await snapshotToday(nextPanels, "upsert");
    }
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
    const nextPanels = panels.map((p) =>
      p.id === panelId ? { ...p, panel_type: type, config: {} } : p,
    );
    setPanels(nextPanels);

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

    if (activeId === defaultDashboardId) {
      await snapshotToday(nextPanels, "upsert");
    }
    showToast(`Swapped to ${PANEL_META[type].label}`);
  }

  const firstName =
    initialProfile?.display_name?.split(" ")[0] ??
    "there";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-8 hidden flex-col items-start gap-4 md:flex md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="flex min-w-0 items-center gap-4 md:flex-1">
          {initialProfile?.daily_selfie_enabled !== false ? (
            <DailySelfieButton
              userId={userId}
              timeZone={initialProfile?.timezone ?? "America/Los_Angeles"}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight md:text-5xl">
              {timeOfDayGreeting()}, {firstName}
            </h1>
            <DashboardHeaderMeta
              variant="inline"
              location={initialProfile?.location}
              timezone={initialProfile?.timezone}
            />
          </div>
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
