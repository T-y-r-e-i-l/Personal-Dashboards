import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardLayoutSnapshot,
  DashboardPanel,
  Json,
} from "@/lib/database.types";

export type SnapshotPanel = {
  panel_type: string;
  config: Json;
  x: number;
  y: number;
  w: number;
  h: number;
};

function isSnapshotPanel(value: unknown): value is SnapshotPanel {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.panel_type === "string" &&
    typeof row.x === "number" &&
    typeof row.y === "number" &&
    typeof row.w === "number" &&
    typeof row.h === "number"
  );
}

export function panelsToSnapshot(
  panels: Pick<
    DashboardPanel,
    "panel_type" | "config" | "x" | "y" | "w" | "h"
  >[],
): SnapshotPanel[] {
  return panels.map((panel) => ({
    panel_type: panel.panel_type,
    config: panel.config ?? {},
    x: panel.x,
    y: panel.y,
    w: panel.w,
    h: panel.h,
  }));
}

export function parseSnapshotPanels(panels: Json): SnapshotPanel[] {
  if (!Array.isArray(panels)) return [];
  return panels.filter(isSnapshotPanel);
}

export function hydratePanelsFromSnapshot(
  snapshot: Pick<
    DashboardLayoutSnapshot,
    "panels" | "dashboard_id" | "user_id" | "snapshot_date"
  >,
): DashboardPanel[] {
  const now = new Date().toISOString();
  return parseSnapshotPanels(snapshot.panels).map((panel, index) => ({
    id: `snap:${snapshot.snapshot_date}:${index}`,
    dashboard_id: snapshot.dashboard_id,
    user_id: snapshot.user_id,
    panel_type: panel.panel_type,
    config: panel.config ?? {},
    x: panel.x,
    y: panel.y,
    w: panel.w,
    h: panel.h,
    created_at: now,
    updated_at: now,
  }));
}

export async function fetchLayoutSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  snapshotDate: string,
): Promise<DashboardLayoutSnapshot | null> {
  const { data, error } = await supabase
    .from("dashboard_layout_snapshots")
    .select("*")
    .eq("user_id", userId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();
  if (error) {
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      return null;
    }
    throw error;
  }
  return (data as DashboardLayoutSnapshot | null) ?? null;
}

export async function ensureLayoutSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  opts: {
    userId: string;
    dashboardId: string;
    snapshotDate: string;
    panels: Pick<
      DashboardPanel,
      "panel_type" | "config" | "x" | "y" | "w" | "h"
    >[];
  },
): Promise<void> {
  const existing = await fetchLayoutSnapshot(
    supabase,
    opts.userId,
    opts.snapshotDate,
  );
  if (existing) return;

  const { error } = await supabase.from("dashboard_layout_snapshots").insert({
    user_id: opts.userId,
    dashboard_id: opts.dashboardId,
    snapshot_date: opts.snapshotDate,
    panels: panelsToSnapshot(opts.panels),
  });
  if (error) {
    if (
      error.code === "23505" ||
      /column|schema cache|relation|does not exist/i.test(error.message)
    ) {
      return;
    }
    throw error;
  }
}

export async function upsertLayoutSnapshot(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  opts: {
    userId: string;
    dashboardId: string;
    snapshotDate: string;
    panels: Pick<
      DashboardPanel,
      "panel_type" | "config" | "x" | "y" | "w" | "h"
    >[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("dashboard_layout_snapshots").upsert(
    {
      user_id: opts.userId,
      dashboard_id: opts.dashboardId,
      snapshot_date: opts.snapshotDate,
      panels: panelsToSnapshot(opts.panels),
      updated_at: now,
    },
    { onConflict: "user_id,snapshot_date" },
  );
  if (error) {
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      return;
    }
    throw error;
  }
}
