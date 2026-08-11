import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  fetchGoogleUserEmail,
} from "@/lib/google/calendar";
import {
  getGoogleConnection,
  upsertGoogleConnection,
} from "@/lib/google/connection";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl()}/settings?google=error&message=${encodeURIComponent(oauthError)}`,
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gcal_oauth_state")?.value;
  const oauthUid = cookieStore.get("gcal_oauth_uid")?.value;

  cookieStore.delete("gcal_oauth_state");
  cookieStore.delete("gcal_oauth_uid");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      `${appUrl()}/settings?google=error&message=${encodeURIComponent("Invalid OAuth state")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (oauthUid && user.id !== oauthUid)) {
    return NextResponse.redirect(`${appUrl()}/login`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await fetchGoogleUserEmail(tokens.access_token);
    const existing = await getGoogleConnection(supabase, user.id);

    await upsertGoogleConnection(
      supabase,
      user.id,
      tokens,
      email,
      existing?.refresh_token,
    );

    return NextResponse.redirect(`${appUrl()}/settings?google=connected`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect Google Calendar";
    return NextResponse.redirect(
      `${appUrl()}/settings?google=error&message=${encodeURIComponent(message)}`,
    );
  }
}
