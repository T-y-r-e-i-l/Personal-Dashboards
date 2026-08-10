import type { SupabaseClient } from "@supabase/supabase-js";
import { getTemplate, type TemplateId } from "@/lib/panels/templates";

export async function seedDashboardFromTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  templateId: TemplateId,
) {
  const template = getTemplate(templateId);

  await supabase
    .from("dashboards")
    .update({ is_default: false })
    .eq("user_id", userId);

  const { data: dashboard, error: dashError } = await supabase
    .from("dashboards")
    .insert({
      user_id: userId,
      name: template.name,
      is_default: true,
    })
    .select()
    .single();

  if (dashError || !dashboard) {
    throw new Error(dashError?.message ?? "Failed to create dashboard");
  }

  if (template.panels.length > 0) {
    const { error: panelsError } = await supabase
      .from("dashboard_panels")
      .insert(
        template.panels.map((p) => ({
          dashboard_id: dashboard.id,
          user_id: userId,
          panel_type: p.panel_type,
          config: p.config ?? {},
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
        })),
      );

    if (panelsError) {
      throw new Error(panelsError.message);
    }
  }

  // Seed a few starter habits for non-blank templates
  if (templateId !== "blank") {
    await supabase.from("habits").insert([
      { user_id: userId, name: "Meditation" },
      { user_id: userId, name: "Exercise" },
      { user_id: userId, name: "Reading" },
    ]);
  }

  await supabase
    .from("profiles")
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return dashboard;
}
