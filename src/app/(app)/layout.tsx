import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardActionsProvider } from "@/components/dashboard/DashboardActionsContext";
import { RetroThemeProvider } from "@/components/providers/RetroThemeProvider";
import { SoundProvider } from "@/components/providers/SoundProvider";

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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("retro_ui_enabled, ui_sounds_enabled")
    .eq("id", user.id)
    .maybeSingle();

  let retroEnabled = profile?.retro_ui_enabled === true;
  let soundsEnabled = profile?.ui_sounds_enabled === true;

  if (profileError && /column|schema cache/i.test(profileError.message)) {
    const { data: fallback } = await supabase
      .from("profiles")
      .select("retro_ui_enabled")
      .eq("id", user.id)
      .maybeSingle();
    retroEnabled = fallback?.retro_ui_enabled === true;
    soundsEnabled = false;
  }

  return (
    <DashboardActionsProvider>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem("pd-retro-ui")==="1")document.documentElement.dataset.theme="retro"}catch(e){}`,
        }}
      />
      <RetroThemeProvider enabled={retroEnabled} />
      <SoundProvider enabled={soundsEnabled}>
        <AppShell email={user.email} retroEnabled={retroEnabled}>
          {children}
        </AppShell>
      </SoundProvider>
    </DashboardActionsProvider>
  );
}
