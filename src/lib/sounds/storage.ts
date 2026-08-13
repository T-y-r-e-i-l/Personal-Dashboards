import type { SupabaseClient } from "@supabase/supabase-js";
import type { UiSoundBinding } from "@/lib/database.types";
import { isSoundSlot, type SoundSlot } from "@/lib/sounds/slots";

export const UI_SOUNDS_BUCKET = "ui-sounds";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
]);

const MAX_BYTES = 2 * 1024 * 1024;

function extForMime(mime: string, filename: string) {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/ogg") return "ogg";
  if (mime === "audio/webm") return "webm";
  if (mime === "audio/mp4") return "m4a";
  return "wav";
}

export function soundStoragePath(
  userId: string,
  slot: SoundSlot,
  mime: string,
  filename: string,
) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}`;
  return `${userId}/${slot}-${id}.${extForMime(mime, filename)}`;
}

export async function fetchSoundBindings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<UiSoundBinding[]> {
  const { data, error } = await supabase
    .from("ui_sound_bindings")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      return [];
    }
    throw error;
  }
  return (data as UiSoundBinding[]) ?? [];
}

export async function resolveSoundUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  storagePath: string,
  expiresIn = 60 * 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(UI_SOUNDS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadSoundBinding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  slot: SoundSlot,
  file: File,
): Promise<UiSoundBinding> {
  if (!isSoundSlot(slot)) throw new Error("Unknown sound slot.");
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error("Use an audio file (mp3, wav, ogg, webm, or m4a).");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Audio file must be 2MB or smaller.");
  }

  const existing = await fetchSoundBindings(supabase, userId);
  const previous = existing.find((b) => b.slot === slot);

  const path = soundStoragePath(userId, slot, file.type, file.name);
  const { error: uploadError } = await supabase.storage
    .from(UI_SOUNDS_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    if (/bucket|not found|does not exist/i.test(uploadError.message)) {
      throw new Error(
        "Run the ui_sounds migration in Supabase to enable sound uploads.",
      );
    }
    throw uploadError;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("ui_sound_bindings")
    .upsert(
      {
        user_id: userId,
        slot,
        storage_path: path,
        original_filename: file.name,
        updated_at: now,
      },
      { onConflict: "user_id,slot" },
    )
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(UI_SOUNDS_BUCKET).remove([path]);
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      throw new Error(
        "Run the ui_sounds migration in Supabase to enable sound uploads.",
      );
    }
    throw error;
  }

  if (previous?.storage_path && previous.storage_path !== path) {
    await supabase.storage
      .from(UI_SOUNDS_BUCKET)
      .remove([previous.storage_path]);
  }

  return data as UiSoundBinding;
}

export async function removeSoundBinding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  slot: SoundSlot,
): Promise<void> {
  const { data, error } = await supabase
    .from("ui_sound_bindings")
    .select("*")
    .eq("user_id", userId)
    .eq("slot", slot)
    .maybeSingle();
  if (error) {
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      return;
    }
    throw error;
  }
  const binding = data as UiSoundBinding | null;
  if (!binding) return;

  const { error: deleteError } = await supabase
    .from("ui_sound_bindings")
    .delete()
    .eq("id", binding.id)
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  await supabase.storage.from(UI_SOUNDS_BUCKET).remove([binding.storage_path]);
}
