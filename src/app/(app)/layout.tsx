import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardActionsProvider } from "@/components/dashboard/DashboardActionsContext";
import { RetroThemeProvider } from "@/components/providers/RetroThemeProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("retro_ui_enabled")
    .eq("id", user.id)
    .maybeSingle();

  const retroEnabled = profile?.retro_ui_enabled === true;

  return (
    <DashboardActionsProvider>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("pd-retro-ui")==="1")document.documentElement.dataset.theme="retro"}catch(e){}`,
        }}
      />
      <RetroThemeProvider enabled={retroEnabled} />
      <AppShell email={user.email}>{children}</AppShell>
    </DashboardActionsProvider>
  );
}
