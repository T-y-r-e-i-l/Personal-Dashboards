import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capture } from "@/lib/database.types";

type Visibility = "private" | "public";

/** Normalize raw capture rows to the Capture shape, tolerating older schemas. */
function mapCaptures(
  rows: Array<Record<string, unknown>>,
  fallbackPrivate = false,
): Capture[] {
  return rows.map((row) => ({
    ...row,
    visibility: (fallbackPrivate
      ? "private"
      : ((row.visibility as Visibility | null | undefined) ?? "private")) as Visibility,
    updated_at:
      (row.updated_at as string | null | undefined) ??
      (row.created_at as string),
  })) as Capture[];
}

/**
 * Fetch every capture created within [startISO, endISO] for a user, ordered
 * oldest-first so exported archives read chronologically. Pass `null` for
 * either bound to leave it open (e.g. both null exports all notes). Unlike the
 * notes list query this is not capped to a small display limit; `max` guards
 * against pathological ranges.
 */
export async function fetchCapturesInRange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  startISO: string | null,
  endISO: string | null,
  max = 2000,
): Promise<Capture[]> {
  const primary = supabase
    .from("captures")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(max);

  if (startISO) primary.gte("created_at", startISO);
  if (endISO) primary.lte("created_at", endISO);

  const primaryResult = await primary;
  if (!primaryResult.error) {
    return mapCaptures(primaryResult.data ?? []);
  }

  // Older schema without the `visibility` column: retry, then mark private.
  const fallback = supabase
    .from("captures")
    .select("id, user_id, content, tags, priority, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(max);

  if (startISO) fallback.gte("created_at", startISO);
  if (endISO) fallback.lte("created_at", endISO);

  const fallbackResult = await fallback;
  if (fallbackResult.error) throw fallbackResult.error;
  return mapCaptures(fallbackResult.data ?? [], true);
}
