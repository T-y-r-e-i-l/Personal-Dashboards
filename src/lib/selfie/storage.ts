import type { SupabaseClient } from "@supabase/supabase-js";
import { getDayRange, shiftPostDate } from "@/lib/blog/dayRange";
import type { DailySelfie } from "@/lib/database.types";

export const DAILY_SELFIES_BUCKET = "daily-selfies";

export function selfiePathForDate(userId: string, selfieDate: string) {
  return `${userId}/${selfieDate}.jpg`;
}

export function todaySelfieDate(timeZone: string, now = new Date()) {
  return getDayRange(timeZone, now).postDate;
}

export function previousSelfieDate(timeZone: string, now = new Date()) {
  return shiftPostDate(todaySelfieDate(timeZone, now), -1);
}

export async function fetchSelfieForDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  selfieDate: string,
): Promise<DailySelfie | null> {
  const { data, error } = await supabase
    .from("daily_selfies")
    .select("*")
    .eq("user_id", userId)
    .eq("selfie_date", selfieDate)
    .maybeSingle();
  if (error) {
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      return null;
    }
    throw error;
  }
  return (data as DailySelfie | null) ?? null;
}

export async function resolveSelfieUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DAILY_SELFIES_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function upsertDailySelfie(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  {
    userId,
    selfieDate,
    blob,
  }: {
    userId: string;
    selfieDate: string;
    blob: Blob;
  },
): Promise<DailySelfie> {
  const storagePath = selfiePathForDate(userId, selfieDate);
  const { error: uploadError } = await supabase.storage
    .from(DAILY_SELFIES_BUCKET)
    .upload(storagePath, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "image/jpeg",
    });
  if (uploadError) {
    if (/bucket not found/i.test(uploadError.message)) {
      throw new Error(
        "Run the daily_selfies migration in Supabase to enable selfies.",
      );
    }
    throw uploadError;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("daily_selfies")
    .upsert(
      {
        user_id: userId,
        selfie_date: selfieDate,
        storage_path: storagePath,
        updated_at: now,
      },
      { onConflict: "user_id,selfie_date" },
    )
    .select("*")
    .single();

  if (error) {
    if (/column|schema cache|relation|does not exist/i.test(error.message)) {
      throw new Error(
        "Run the daily_selfies migration in Supabase to enable selfies.",
      );
    }
    throw error;
  }

  return data as DailySelfie;
}
