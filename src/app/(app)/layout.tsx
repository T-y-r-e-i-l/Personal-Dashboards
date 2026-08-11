import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardActionsProvider } from "@/components/dashboard/DashboardActionsContext";

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

  return (
    <DashboardActionsProvider>
      <AppShell email={user.email}>{children}</AppShell>
    </DashboardActionsProvider>
  );
}
