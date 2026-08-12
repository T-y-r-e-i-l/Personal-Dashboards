"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { GoogleCalendarConnect } from "@/components/settings/GoogleCalendarConnect";
import { applyRetroTheme } from "@/components/providers/RetroThemeProvider";

export default function SettingsPage() {
  const router = useRouter();
  const showToast = useToast((s) => s.show);
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [dailySelfieEnabled, setDailySelfieEnabled] = useState(true);
  const [retroUiEnabled, setRetroUiEnabled] = useState(false);
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
        setDailySelfieEnabled(data.daily_selfie_enabled !== false);
        setRetroUiEnabled(data.retro_ui_enabled === true);
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

    const payload = {
      display_name: displayName,
      location,
      timezone,
      daily_selfie_enabled: dailySelfieEnabled,
      retro_ui_enabled: retroUiEnabled,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (error && /column|schema cache/i.test(error.message)) {
      ({ error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          location,
          timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id));
      if (!error) {
        showToast(
          "Profile saved. Run the latest profiles migrations to persist selfie/retro toggles.",
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    if (error) {
      showToast(error.message);
      return;
    }
    applyRetroTheme(retroUiEnabled);
    showToast("Settings saved");
    router.refresh();
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
        <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <input
            type="checkbox"
            checked={dailySelfieEnabled}
            onChange={(e) => setDailySelfieEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">
              Show daily selfie beside greeting
            </span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Capture a daily photo with yesterday’s image ghosted for
              alignment—building a personal timelapse over time.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <input
            type="checkbox"
            checked={retroUiEnabled}
            onChange={(e) => setRetroUiEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Retro Style</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">
              Classic Macintosh 8-bit look for the app.
            </span>
          </span>
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
