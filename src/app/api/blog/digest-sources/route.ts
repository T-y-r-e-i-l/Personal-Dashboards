import { NextResponse } from "next/server";
import { collectDayContext } from "@/lib/blog/collectDayContext";
import { isValidPostDate } from "@/lib/blog/dayRange";
import { inventoryFromDayContext } from "@/lib/blog/digestSelection";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !isValidPostDate(date)) {
    return NextResponse.json(
      { error: "Invalid date. Expected yyyy-MM-dd." },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone, location")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const timezone = profile?.timezone || "America/Los_Angeles";
  const location = profile?.location ?? null;

  try {
    const { context } = await collectDayContext(
      supabase,
      user.id,
      timezone,
      location,
      { postDate: date },
    );
    return NextResponse.json({
      ok: true,
      ...inventoryFromDayContext(context),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load digest sources";
    console.error("[blog/digest-sources]", user.id, date, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
