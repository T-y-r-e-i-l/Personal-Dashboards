import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestSelfie, resolveSelfieUrl } from "@/lib/selfie/storage";

export type PublicNoteAuthor = {
  displayName: string;
  selfieUrl: string | null;
  initials: string;
  retroUiEnabled: boolean;
};

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export async function fetchPublicNoteAuthor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<PublicNoteAuthor> {
  let { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, retro_ui_enabled")
    .eq("id", userId)
    .maybeSingle();

  if (error && /column|schema cache/i.test(error.message)) {
    ({ data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle());
  }

  const rawName =
    typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  const displayName = rawName || "Someone";

  let selfieUrl: string | null = null;
  try {
    const selfie = await fetchLatestSelfie(supabase, userId);
    if (selfie?.storage_path) {
      selfieUrl = await resolveSelfieUrl(supabase, selfie.storage_path);
    }
  } catch {
    selfieUrl = null;
  }

  return {
    displayName,
    selfieUrl,
    initials: initialsFromName(displayName),
    retroUiEnabled: profile?.retro_ui_enabled === true,
  };
}
