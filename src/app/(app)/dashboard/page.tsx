import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardHome } from "@/components/dashboard/DashboardHome";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: dashboards } = await supabase
    .from("dashboards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!profile?.onboarding_completed && (!dashboards || dashboards.length === 0)) {
    redirect("/onboarding");
  }

  const defaultDashboard =
    dashboards?.find((d) => d.is_default) ?? dashboards?.[0] ?? null;

  const { data: panels } = defaultDashboard
    ? await supabase
        .from("dashboard_panels")
        .select("*")
        .eq("dashboard_id", defaultDashboard.id)
        .order("y", { ascending: true })
    : { data: [] };

  return (
    <DashboardHome
      userId={user.id}
      initialProfile={profile}
      initialDashboards={dashboards ?? []}
      initialPanels={panels ?? []}
    />
  );
}
