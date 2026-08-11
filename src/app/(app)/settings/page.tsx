"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { GoogleCalendarConnect } from "@/components/settings/GoogleCalendarConnect";

export default function SettingsPage() {
  const showToast = useToast((s) => s.show);
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setDisplayName(data.display_name ?? "");
        setLocation(data.location ?? "");
        setTimezone(data.timezone ?? "America/Los_Angeles");
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        location,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);
    showToast(error ? error.message : "Settings saved");
  }

  if (loading) {
    return <main className="p-8 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-10 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Settings
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Profile details and integrations for your dashboard.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
        <GoogleCalendarConnect />
      </Suspense>

      <form onSubmit={onSave} className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">
            Location (for weather)
          </span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Spokane, WA"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Timezone</span>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none ring-[var(--accent)] focus:ring-2"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--canvas)] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </main>
  );
}
