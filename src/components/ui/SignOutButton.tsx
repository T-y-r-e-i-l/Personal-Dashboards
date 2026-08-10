"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="mt-2 text-left text-sm font-medium text-[var(--muted)] transition hover:text-[var(--ink)]"
    >
      Sign out
    </button>
  );
}
