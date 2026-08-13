import { NextResponse } from "next/server";
import { isValidPostDate } from "@/lib/blog/dayRange";
import { generateDailyBlogPost } from "@/lib/blog/generatePost";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const date =
    typeof body === "object" &&
    body !== null &&
    "date" in body &&
    typeof (body as { date: unknown }).date === "string"
      ? (body as { date: string }).date
      : null;

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
    const result = await generateDailyBlogPost(
      supabase,
      user.id,
      timezone,
      location,
      { postDate: date, overwrite: true },
    );

    if (result.reason === "empty_day") {
      return NextResponse.json(
        {
          ok: false,
          postDate: date,
          created: false,
          updated: false,
          reason: "empty_day",
          error:
            "Nothing to summarize for this day (no notes, tasks, or other activity).",
        },
        { status: 400 },
      );
    }

    if (!result.post) {
      return NextResponse.json(
        {
          ok: false,
          postDate: date,
          created: false,
          updated: false,
          reason: result.reason ?? "error",
          error: result.reason ?? "Could not generate digest.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      postDate: date,
      created: result.created,
      updated: result.updated,
      postId: result.post.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Digest generation failed";
    console.error("[blog/regenerate]", user.id, date, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
