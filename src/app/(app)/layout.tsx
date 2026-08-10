import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/ui/SignOutButton";

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
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]/70 px-4 py-6 backdrop-blur md:flex">
        <Link
          href="/dashboard"
          className="px-2 font-[family-name:var(--font-display)] text-lg tracking-tight"
        >
          Personal Dashboards
        </Link>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          <Link
            href="/dashboard"
            className="rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-soft)]"
          >
            Today
          </Link>
          <Link
            href="/settings"
            className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
          >
            Settings
          </Link>
        </nav>
        <div className="px-2">
          <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 md:hidden">
          <Link
            href="/dashboard"
            className="font-[family-name:var(--font-display)] text-lg"
          >
            Personal Dashboards
          </Link>
          <Link href="/settings" className="text-sm text-[var(--muted)]">
            Settings
          </Link>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
