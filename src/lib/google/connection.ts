import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expiresAtFromTokens,
  refreshAccessToken,
  type GoogleTokens,
} from "@/lib/google/calendar";

type ConnectionRow = {
  user_id: string;
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
};

export async function getGoogleConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as ConnectionRow | null;
}

export async function upsertGoogleConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  tokens: GoogleTokens,
  email: string | null,
  existingRefreshToken?: string | null,
) {
  const refresh_token =
    tokens.refresh_token ?? existingRefreshToken ?? null;

  const { error } = await supabase.from("google_calendar_connections").upsert({
    user_id: userId,
    email,
    access_token: tokens.access_token,
    refresh_token,
    expires_at: expiresAtFromTokens(tokens),
    scope: tokens.scope ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function getValidGoogleAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  options?: { forceRefresh?: boolean },
): Promise<{
  accessToken: string;
  email: string | null;
  refreshToken: string | null;
} | null> {
  const connection = await getGoogleConnection(supabase, userId);
  if (!connection) return null;

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;
  const stillValid = expiresAt - Date.now() > 60_000;

  if (stillValid && !options?.forceRefresh) {
    return {
      accessToken: connection.access_token,
      email: connection.email,
      refreshToken: connection.refresh_token,
    };
  }

  if (!connection.refresh_token) {
    return {
      accessToken: connection.access_token,
      email: connection.email,
      refreshToken: null,
    };
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  await upsertGoogleConnection(
    supabase,
    userId,
    refreshed,
    connection.email,
    connection.refresh_token,
  );

  return {
    accessToken: refreshed.access_token,
    email: connection.email,
    refreshToken: connection.refresh_token,
  };
}
