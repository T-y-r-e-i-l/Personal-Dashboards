"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useSound } from "@/components/providers/SoundProvider";
import type { UiSoundBinding } from "@/lib/database.types";
import {
  DEFAULT_CLICK_SRC,
  SOUND_SLOT_CATALOG,
  type SoundSlot,
} from "@/lib/sounds/slots";
import {
  fetchSoundBindings,
  removeSoundBinding,
  resolveSoundUrl,
  uploadSoundBinding,
} from "@/lib/sounds/storage";

type SlotState = {
  binding: UiSoundBinding | null;
  previewUrl: string | null;
};

export default function SoundsPage() {
  const showToast = useToast((s) => s.show);
  const { enabled, setEnabled, play, reloadBindings } = useSound();
  const [loading, setLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const [busySlot, setBusySlot] = useState<SoundSlot | null>(null);
  const [slots, setSlots] = useState<Record<SoundSlot, SlotState>>(() => {
    const initial = {} as Record<SoundSlot, SlotState>;
    for (const meta of SOUND_SLOT_CATALOG) {
      initial[meta.id] = { binding: null, previewUrl: null };
    }
    return initial;
  });

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("ui_sounds_enabled")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && typeof profile.ui_sounds_enabled === "boolean") {
      setEnabled(profile.ui_sounds_enabled);
    }

    const bindings = await fetchSoundBindings(supabase, user.id);
    const next = {} as Record<SoundSlot, SlotState>;
    for (const meta of SOUND_SLOT_CATALOG) {
      next[meta.id] = { binding: null, previewUrl: null };
    }
    await Promise.all(
      bindings.map(async (binding) => {
        const slot = binding.slot as SoundSlot;
        if (!(slot in next)) return;
        const previewUrl = await resolveSoundUrl(supabase, binding.storage_path);
        next[slot] = { binding, previewUrl };
      }),
    );
    setSlots(next);
    setLoading(false);
  }, [setEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggleEnabled(next: boolean) {
    setSavingToggle(true);
    setEnabled(next);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingToggle(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        ui_sounds_enabled: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSavingToggle(false);
    if (error) {
      setEnabled(!next);
      showToast(error.message, { variant: "error" });
      return;
    }
    if (next) void reloadBindings();
    showToast(next ? "UI sounds enabled" : "UI sounds disabled");
  }

  async function onUpload(slot: SoundSlot, file: File | null) {
    if (!file) return;
    setBusySlot(slot);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusySlot(null);
      return;
    }
    try {
      const binding = await uploadSoundBinding(supabase, user.id, slot, file);
      const previewUrl = await resolveSoundUrl(supabase, binding.storage_path);
      setSlots((prev) => ({
        ...prev,
        [slot]: { binding, previewUrl },
      }));
      await reloadBindings();
      showToast(`Uploaded sound for ${slot.replaceAll("_", " ")}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", {
        variant: "error",
      });
    } finally {
      setBusySlot(null);
    }
  }

  async function onRemove(slot: SoundSlot) {
    setBusySlot(slot);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusySlot(null);
      return;
    }
    try {
      await removeSoundBinding(supabase, user.id, slot);
      setSlots((prev) => ({
        ...prev,
        [slot]: { binding: null, previewUrl: null },
      }));
      await reloadBindings();
      showToast("Custom sound removed");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Remove failed", {
        variant: "error",
      });
    } finally {
      setBusySlot(null);
    }
  }

  function previewSrc(slot: SoundSlot) {
    const state = slots[slot];
    if (state.previewUrl) return state.previewUrl;
    if (slot === "generic_click") return DEFAULT_CLICK_SRC;
    if (slots.generic_click.previewUrl) return slots.generic_click.previewUrl;
    return DEFAULT_CLICK_SRC;
  }

  function sourceLabel(slot: SoundSlot) {
    const state = slots[slot];
    if (state.binding?.original_filename) {
      return `Custom: ${state.binding.original_filename}`;
    }
    if (slot === "generic_click") return "Built-in default click";
    if (slots.generic_click.binding) {
      return `Fallback: ${slots.generic_click.binding.original_filename ?? "generic click"}`;
    }
    return "Built-in default click";
  }

  if (loading) {
    return <main className="p-8 text-sm text-[var(--muted)]">Loading…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Sounds
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Map short audio clips to UI actions. With sounds enabled, every action
          uses the built-in click until you upload a custom file for that slot
          (or replace the generic click).
        </p>
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-4 py-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={savingToggle}
          onChange={(e) => void onToggleEnabled(e.target.checked)}
          className="size-4"
        />
        <span>
          <span className="block text-sm font-medium">Enable UI sounds</span>
          <span className="block text-xs text-[var(--muted)]">
            Off by default. When on, unbound slots play the default click.
          </span>
        </span>
      </label>

      <ul className="space-y-4">
        {SOUND_SLOT_CATALOG.map((meta) => {
          const busy = busySlot === meta.id;
          return (
            <li
              key={meta.id}
              className="rounded-lg border border-[var(--border)] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold tracking-tight">
                    {meta.label}
                  </h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {meta.description}
                  </p>
                  <p className="mt-2 text-xs text-[var(--ink)]">
                    {sourceLabel(meta.id)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface)]"
                    onClick={() => {
                      const audio = new Audio(previewSrc(meta.id));
                      void audio.play().catch(() => {});
                    }}
                  >
                    Preview
                  </button>
                  <label className="cursor-pointer rounded border border-[var(--border)] px-2.5 py-1 text-xs hover:bg-[var(--surface)]">
                    {busy ? "…" : "Upload"}
                    <input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.mp3,.wav,.ogg,.webm,.m4a"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = "";
                        void onUpload(meta.id, file);
                      }}
                    />
                  </label>
                  {slots[meta.id].binding ? (
                    <button
                      type="button"
                      className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface)]"
                      disabled={busy}
                      onClick={() => void onRemove(meta.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-[var(--muted)]">
        Tip: upload once to Generic click to change the default for all unbound
        actions. Specific slots always win when set.
        {enabled ? (
          <>
            {" "}
            <button
              type="button"
              className="underline"
              onClick={() => play("button_click")}
            >
              Test click
            </button>
          </>
        ) : null}
      </p>
    </main>
  );
}
