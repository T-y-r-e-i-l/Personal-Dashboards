"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEMPLATES, type TemplateId } from "@/lib/panels/templates";
import { seedDashboardFromTemplate } from "@/lib/panels/seed";
import { useToast } from "@/components/ui/Toast";

export default function OnboardingPage() {
  const router = useRouter();
  const showToast = useToast((s) => s.show);
  const [selected, setSelected] = useState<TemplateId>("morning");
  const [loading, setLoading] = useState(false);

  async function continueWithTemplate() {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    try {
      await seedDashboardFromTemplate(supabase, user.id, selected);
      showToast("Dashboard ready");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--accent)]">
        Onboarding
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight">
        Choose a starting layout
      </h1>
      <p className="mt-3 max-w-xl text-[var(--muted)]">
        You can rearrange and add panels anytime. Pick a template to get going
        faster.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {TEMPLATES.map((template) => {
          const active = selected === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelected(template.id)}
              className={`rounded-[20px] border p-5 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[var(--shadow-soft)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              <h2 className="text-lg font-semibold">{template.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {template.description}
              </p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={continueWithTemplate}
        className="mt-10 rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--canvas)] disabled:opacity-60"
      >
        {loading ? "Setting up…" : "Continue"}
      </button>
    </main>
  );
}
