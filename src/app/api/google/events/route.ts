import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GoogleApiError, listGoogleEvents } from "@/lib/google/calendar";
import { getValidGoogleAccessToken } from "@/lib/google/connection";

const querySchema = z.object({
  timeMin: z.string().min(1),
  timeMax: z.string().min(1),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    timeMin: searchParams.get("timeMin"),
    timeMax: searchParams.get("timeMax"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  try {
    let token = await getValidGoogleAccessToken(supabase, user.id);
    if (!token) {
      return NextResponse.json({ connected: false, events: [] });
    }

    try {
      const events = await listGoogleEvents(
        token.accessToken,
        parsed.data.timeMin,
        parsed.data.timeMax,
      );

      return NextResponse.json({
        connected: true,
        email: token.email,
        events,
      });
    } catch (err) {
      // Access token may be stale even if expiry looks valid — refresh once.
      if (
        err instanceof GoogleApiError &&
        err.status === 401 &&
        token.refreshToken
      ) {
        token = await getValidGoogleAccessToken(supabase, user.id, {
          forceRefresh: true,
        });
        if (!token) {
          throw err;
        }

        const events = await listGoogleEvents(
          token.accessToken,
          parsed.data.timeMin,
          parsed.data.timeMax,
        );

        return NextResponse.json({
          connected: true,
          email: token.email,
          events,
        });
      }
      throw err;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load Google events";
    console.error("[google/events]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
