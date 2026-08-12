import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PublicCapture = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  visibility: string;
};

export async function fetchPublicCapture(id: string): Promise<{
  data: PublicCapture | null;
  error: Error | null;
  admin: SupabaseClient | null;
}> {
  const select =
    "id, user_id, content, created_at, updated_at, visibility" as const;

  try {
    const admin = createAdminClient();
    const result = await admin
      .from("captures")
      .select(select)
      .eq("id", id)
      .eq("visibility", "public")
      .maybeSingle();
    if (!result.error) {
      return {
        data: (result.data as PublicCapture | null) ?? null,
        error: null,
        admin,
      };
    }
  } catch {
    // Missing SUPABASE_SERVICE_ROLE_KEY in local/dev — fall through.
  }

  const supabase = await createClient();
  const result = await supabase
    .from("captures")
    .select(select)
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();

  return {
    data: (result.data as PublicCapture | null) ?? null,
    error: result.error ? new Error(result.error.message) : null,
    admin: null,
  };
}
